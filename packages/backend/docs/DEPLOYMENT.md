# 🚢 Sovren Backend Deployment Guide

**Production deployment guide for Sovren Backend v1.0.0**

## 🎯 Overview

This guide covers deployment of the Sovren Backend to various production environments, including cloud platforms, container orchestration, and traditional server setups. The backend is designed for **enterprise-grade scalability** and **high availability**.

### 🏗️ Architecture Requirements

- **Node.js 18+** runtime environment
- **PostgreSQL database** (via Supabase or self-hosted)
- **HTTPS/TLS** for secure communication
- **Load balancer** for high availability (recommended)
- **Redis** for caching (optional but recommended)

---

## 🚀 Quick Production Setup

### 1. Environment Preparation

```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
nano .env.production
```

### 2. Required Environment Variables

```env
# 🗄️ Database Configuration (REQUIRED)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key

# 🔑 Security Configuration (REQUIRED)
JWT_SECRET=your-ultra-secure-256-bit-secret-key-here
JWT_EXPIRES_IN=24h

# 🌐 Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 🔒 Additional Security (Recommended)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
CORS_ORIGIN=https://sovren.com,https://app.sovren.com

# 📊 Monitoring (Optional)
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_PATH=/health
```

### 3. Build and Deploy

```bash
# Install production dependencies
npm ci --only=production

# Build application
npm run build

# Start production server
npm start
```

---

## 🌊 Cloud Platform Deployments

### 🔵 Digital Ocean App Platform

#### 1. Create App Spec (`app.yaml`)

```yaml
name: sovren-backend
services:
- name: api
  source_dir: packages/backend
  github:
    repo: your-org/sovren
    branch: main
    deploy_on_push: true
  build_command: npm ci && npm run build
  run_command: npm start
  environment_slug: node-js
  instance_count: 2
  instance_size_slug: basic-xxs
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "8080"
  - key: SUPABASE_URL
    value: ${SUPABASE_URL}
  - key: SUPABASE_ANON_KEY
    value: ${SUPABASE_ANON_KEY}
  - key: JWT_SECRET
    value: ${JWT_SECRET}
  health_check:
    http_path: /health
```

#### 2. Deploy Command

```bash
# Using doctl CLI
doctl apps create --spec app.yaml

# Or via dashboard
# 1. Connect GitHub repository
# 2. Set environment variables
# 3. Configure health checks
```

### 🟢 Vercel Deployment

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Configure `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### 3. Deploy

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add JWT_SECRET production
```

### 🟡 Heroku Deployment

#### 1. Create Heroku App

```bash
# Install Heroku CLI
npm install -g heroku

# Create app
heroku create sovren-backend-prod

# Add buildpack
heroku buildpacks:set heroku/nodejs
```

#### 2. Configure Environment

```bash
# Set required environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL="https://your-project.supabase.co"
heroku config:set SUPABASE_ANON_KEY="your-anon-key"
heroku config:set JWT_SECRET="your-secret-key"
```

#### 3. Deploy

```bash
# Deploy from Git
git push heroku main

# Scale dynos
heroku ps:scale web=2
```

### 🔴 AWS Deployment

#### 1. AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize application
eb init sovren-backend

# Create environment
eb create production

# Set environment variables
eb setenv NODE_ENV=production SUPABASE_URL=your-url JWT_SECRET=your-secret

# Deploy
eb deploy
```

#### 2. AWS ECS with Fargate

```dockerfile
# Create Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3001

CMD ["npm", "start"]
```

```yaml
# Task Definition (task-definition.json)
{
  "family": "sovren-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "sovren-backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/sovren-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

---

## 🐳 Docker Deployments

### 1. Production Dockerfile

```dockerfile
# Multi-stage build for optimal size
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Runtime stage
FROM node:18-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=backend:nodejs dist ./dist
COPY --chown=backend:nodejs package*.json ./

# Security hardening
RUN apk --no-cache add dumb-init
RUN rm -rf /tmp/* /var/cache/apk/*

USER backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
```

### 2. Build and Run

```bash
# Build image
docker build -t sovren-backend:1.0.0 .

# Run container
docker run -d \
  --name sovren-backend \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e SUPABASE_URL="your-url" \
  -e SUPABASE_ANON_KEY="your-key" \
  -e JWT_SECRET="your-secret" \
  sovren-backend:1.0.0
```

### 3. Docker Compose Production

```yaml
version: '3.8'

services:
  sovren-backend:
    image: sovren-backend:1.0.0
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - sovren-backend
    restart: unless-stopped
```

---

## ☸️ Kubernetes Deployment

### 1. Namespace and ConfigMap

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sovren

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sovren-backend-config
  namespace: sovren
data:
  NODE_ENV: "production"
  PORT: "3001"
  LOG_LEVEL: "info"
```

### 2. Secret Management

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: sovren-backend-secret
  namespace: sovren
type: Opaque
data:
  SUPABASE_URL: <base64-encoded-value>
  SUPABASE_ANON_KEY: <base64-encoded-value>
  JWT_SECRET: <base64-encoded-value>
```

### 3. Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sovren-backend
  namespace: sovren
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sovren-backend
  template:
    metadata:
      labels:
        app: sovren-backend
    spec:
      containers:
      - name: sovren-backend
        image: sovren-backend:1.0.0
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: sovren-backend-config
        - secretRef:
            name: sovren-backend-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: sovren-backend-service
  namespace: sovren
spec:
  selector:
    app: sovren-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sovren-backend-ingress
  namespace: sovren
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.sovren.com
    secretName: sovren-backend-tls
  rules:
  - host: api.sovren.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sovren-backend-service
            port:
              number: 80
```

### 4. Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml

# Check deployment status
kubectl get pods -n sovren
kubectl logs -f deployment/sovren-backend -n sovren
```

---

## 🔧 Traditional Server Deployment

### 1. Ubuntu/Debian Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash sovren
sudo usermod -aG sudo sovren

# Setup application directory
sudo mkdir -p /opt/sovren
sudo chown sovren:sovren /opt/sovren
```

### 2. Application Deployment

```bash
# Switch to application user
sudo -u sovren -i

# Clone and setup application
cd /opt/sovren
git clone <repository-url> .
npm ci --only=production
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sovren-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'your-supabase-url',
      SUPABASE_ANON_KEY: 'your-anon-key',
      JWT_SECRET: 'your-jwt-secret'
    }
  }]
};
EOF
```

### 3. Start and Monitor

```bash
# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor application
pm2 monit
pm2 logs sovren-backend
```

### 4. Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/sovren-backend << EOF
upstream sovren_backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name api.sovren.com;

    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.sovren.com;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/sovren.crt;
    ssl_certificate_key /etc/ssl/private/sovren.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to backend
    location / {
        proxy_pass http://sovren_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://sovren_backend/health;
        access_log off;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/sovren-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 Production Monitoring

### 1. Health Checks

```bash
# Basic health check
curl -f http://localhost:3001/health

# Detailed health check with response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/health
```

### 2. PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Application logs
pm2 logs sovren-backend --lines 100

# Performance metrics
pm2 show sovren-backend
```

### 3. System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop netstat-nat

# Monitor system resources
htop
iotop -o
netstat -tlnp | grep :3001
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# UFW firewall setup
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # Block direct access to app
```

### 2. SSL/TLS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.sovren.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Security Updates

```bash
# Automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# Configure in /etc/apt/apt.conf.d/20auto-upgrades:
# APT::Periodic::Update-Package-Lists "1";
# APT::Periodic::Unattended-Upgrade "1";
```

---

## 📈 Scaling Strategies

### 1. Horizontal Scaling

#### Load Balancer Configuration (HAProxy)

```bash
# Install HAProxy
sudo apt install haproxy

# Configure /etc/haproxy/haproxy.cfg
global
    daemon
    maxconn 256

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend sovren_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/sovren.pem
    redirect scheme https if !{ ssl_fc }
    default_backend sovren_backend

backend sovren_backend
    balance roundrobin
    option httpchk GET /health
    server app1 10.0.1.10:3001 check
    server app2 10.0.1.11:3001 check
    server app3 10.0.1.12:3001 check
```

### 2. Database Scaling

```bash
# Supabase connection pooling configuration
DATABASE_MAX_CONNECTIONS=20
DATABASE_POOL_TIMEOUT=30000
DATABASE_IDLE_TIMEOUT=600000
```

### 3. Caching Layer

```bash
# Redis setup for session caching
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# Environment variables
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs sovren-backend

# Check environment variables
pm2 env sovren-backend

# Check port availability
sudo netstat -tlnp | grep :3001
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
client.from('users').select('count').single().then(console.log).catch(console.error);
"
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/sovren.crt -text -noout

# Test SSL connection
openssl s_client -connect api.sovren.com:443
```

### Performance Debugging

```bash
# Memory usage
node --max-old-space-size=512 dist/server.js

# CPU profiling
node --prof dist/server.js
node --prof-process isolate-*.log

# Heap analysis
node --inspect dist/server.js
# Connect Chrome DevTools to localhost:9229
```

---

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Health checks implemented
- [ ] Monitoring setup

### Post-Deployment

- [ ] Health endpoint responding
- [ ] Authentication flow working
- [ ] Database connectivity verified
- [ ] Logs being generated
- [ ] Performance metrics collected
- [ ] Security scan completed
- [ ] Load testing performed

### Production Readiness

- [ ] Horizontal scaling tested
- [ ] Backup procedures verified
- [ ] Disaster recovery plan tested
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Team training completed

---

## 📞 Support

### Emergency Contacts

- **Technical Issues**: engineering@sovren.com
- **Security Issues**: security@sovren.com
- **Infrastructure Issues**: ops@sovren.com

### Monitoring Dashboards

- **Application Health**: `/health` endpoint
- **System Metrics**: PM2 monitoring dashboard
- **Error Tracking**: Application logs via PM2
- **Performance**: System resource monitoring

---

*Deployment Guide v1.0.0 - Last Updated: Phase 1 Completion*
