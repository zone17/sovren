const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// JWT Secret from file
let jwtSecret;
try {
  const secretPath = process.env.JWT_SECRET_FILE || '/run/secrets/mcp_jwt_secret';
  jwtSecret = fs.readFileSync(secretPath, 'utf8').trim();
} catch (error) {
  console.error('Failed to read JWT secret:', error.message);
  process.exit(1);
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Compression
app.use(compression());

// Body parsing with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    res.status(429).json({ error: 'Too many requests' });
  },
});
app.use(limiter);

// Audit logging
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: '/var/log/mcp/audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Request validation schemas
const mcpRequestSchema = Joi.object({
  jsonrpc: Joi.string().valid('2.0').required(),
  method: Joi.string()
    .valid(
      'tools/list',
      'tools/call',
      'resources/list',
      'resources/read',
      'prompts/list',
      'prompts/get'
    )
    .required(),
  params: Joi.object().optional(),
  id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    auditLogger.warn('Unauthorized access attempt - no token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      auditLogger.warn('Invalid token used', {
        ip: req.ip,
        error: err.message,
        path: req.path,
      });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Request validation middleware
const validateMCPRequest = (req, res, next) => {
  const { error } = mcpRequestSchema.validate(req.body);
  if (error) {
    auditLogger.warn('Invalid MCP request format', {
      ip: req.ip,
      error: error.details,
      body: req.body,
    });
    return res.status(400).json({
      error: 'Invalid request format',
      details: error.details,
    });
  }
  next();
};

// MCP server routing configuration
const mcpServers = {
  github: { host: 'mcp-github', port: 3000 },
  postgres: { host: 'mcp-postgres', port: 3000 },
  filesystem: { host: 'mcp-filesystem', port: 3000 },
  memory: { host: 'mcp-memory', port: 8080 },
  puppeteer: { host: 'mcp-puppeteer', port: 3000 },
};

// Create proxy middleware for each MCP server
Object.entries(mcpServers).forEach(([serverName, config]) => {
  const proxyOptions = {
    target: `http://${config.host}:${config.port}`,
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      [`^/api/mcp/${serverName}`]: '/',
    },
    onProxyReq: (proxyReq, req, res) => {
      auditLogger.info('MCP request', {
        server: serverName,
        user: req.user?.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.body?.id,
      });

      // Add security headers to proxy request
      proxyReq.setHeader('X-Forwarded-User', req.user?.id || 'anonymous');
      proxyReq.setHeader('X-Request-ID', req.body?.id || 'unknown');
    },
    onProxyRes: (proxyRes, req, res) => {
      auditLogger.info('MCP response', {
        server: serverName,
        user: req.user?.id,
        statusCode: proxyRes.statusCode,
        path: req.path,
        requestId: req.body?.id,
        responseTime: Date.now() - req.startTime,
      });

      // Remove sensitive headers
      delete proxyRes.headers['x-powered-by'];
      delete proxyRes.headers['server'];
    },
    onError: (err, req, res) => {
      auditLogger.error('MCP proxy error', {
        server: serverName,
        user: req.user?.id,
        error: err.message,
        path: req.path,
        requestId: req.body?.id,
      });

      if (!res.headersSent) {
        res.status(502).json({
          error: 'Service temporarily unavailable',
          requestId: req.body?.id,
        });
      }
    },
  };

  app.use(
    `/api/mcp/${serverName}`,
    authenticateToken,
    validateMCPRequest,
    (req, res, next) => {
      req.startTime = Date.now();
      next();
    },
    createProxyMiddleware(proxyOptions)
  );
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Metrics endpoint (for Prometheus)
app.get('/metrics', authenticateToken, (req, res) => {
  // Basic metrics - in production, use prometheus client
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP mcp_requests_total Total number of MCP requests
# TYPE mcp_requests_total counter
mcp_requests_total 0

# HELP mcp_requests_failed_total Total number of failed MCP requests
# TYPE mcp_requests_failed_total counter
mcp_requests_failed_total 0

# HELP mcp_unauthorized_attempts_total Total unauthorized access attempts
# TYPE mcp_unauthorized_attempts_total counter
mcp_unauthorized_attempts_total 0
  `);
});

// Token generation endpoint (for development/testing)
app.post('/auth/token', (req, res) => {
  const { username, password } = req.body;

  // In production, validate against real user store
  if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ id: username, role: 'admin' }, jwtSecret, { expiresIn: '24h' });

    auditLogger.info('Token generated', {
      user: username,
      ip: req.ip,
    });

    res.json({ token });
  } else {
    auditLogger.warn('Failed login attempt', {
      username,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  auditLogger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    ip: req.ip,
    user: req.user?.id,
  });

  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  auditLogger.warn('404 - Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  auditLogger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  auditLogger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  auditLogger.info(`MCP Gateway started on port ${port}`, {
    port,
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid,
  });
});
