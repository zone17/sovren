#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates environment configuration before starting development or deployment
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logError(message) {
  console.error(colorize(`❌ ${message}`, 'red'));
}

function logWarning(message) {
  console.warn(colorize(`⚠️  ${message}`, 'yellow'));
}

function logSuccess(message) {
  console.log(colorize(`✅ ${message}`, 'green'));
}

function logInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'blue'));
}

// Required environment variables by category
const REQUIRED_VARS = {
  core: ['NODE_ENV', 'PORT'],
  supabase: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  authentication: ['JWT_SECRET', 'SESSION_SECRET'],
  lightning: [
    'LNBITS_API_URL',
    'LNBITS_ADMIN_KEY',
    'LNBITS_INVOICE_READ_KEY',
    'LNBITS_WEBHOOK_SECRET',
  ],
  nostr: ['NOSTR_RELAYS'],
};

// Production-specific required variables
const PRODUCTION_REQUIRED_VARS = ['DOMAIN', 'SSL_EMAIL', 'SENTRY_DSN', 'CORS_ORIGIN'];

// Validation functions
function validateUrl(value, name) {
  try {
    new URL(value);
    return true;
  } catch {
    logError(`${name} must be a valid URL, got: ${value}`);
    return false;
  }
}

function validateEmail(value, name) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    logError(`${name} must be a valid email address, got: ${value}`);
    return false;
  }
  return true;
}

function validatePort(value, name) {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    logError(`${name} must be a valid port number (1-65535), got: ${value}`);
    return false;
  }
  return true;
}

function validateJWTSecret(value, isProduction) {
  const minLength = isProduction ? 64 : 32;
  if (value.length < minLength) {
    logError(
      `JWT_SECRET must be at least ${minLength} characters in ${isProduction ? 'production' : 'development'}, got ${value.length} characters`
    );
    return false;
  }
  return true;
}

function validateNostrRelays(value) {
  const relays = value.split(',').map((r) => r.trim());
  const invalidRelays = relays.filter(
    (relay) => !relay.startsWith('wss://') && !relay.startsWith('ws://')
  );

  if (invalidRelays.length > 0) {
    logError(
      `NOSTR relays must start with ws:// or wss://, invalid relays: ${invalidRelays.join(', ')}`
    );
    return false;
  }
  return true;
}

function validateLightningAmounts(minAmount, maxAmount) {
  const min = parseInt(minAmount, 10);
  const max = parseInt(maxAmount, 10);

  if (isNaN(min) || isNaN(max)) {
    logError('Lightning amounts must be valid numbers');
    return false;
  }

  if (min >= max) {
    logError(`LIGHTNING_MIN_AMOUNT (${min}) must be less than LIGHTNING_MAX_AMOUNT (${max})`);
    return false;
  }

  return true;
}

// Main validation function
function validateEnvironment() {
  log(colorize('\n🔍 Sovren Environment Validation', 'bright'));
  log('=====================================\n');

  // Load environment variables
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), 'env.example');

  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    logError('.env file not found!');
    if (fs.existsSync(envExamplePath)) {
      logInfo('Please copy env.example to .env and configure it:');
      logInfo('cp env.example .env');
    }
    process.exit(1);
  }

  // Load .env file
  require('dotenv').config({ path: envPath });

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  logInfo(`Environment: ${colorize(nodeEnv.toUpperCase(), 'cyan')}`);
  log('');

  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables by category
  for (const [category, vars] of Object.entries(REQUIRED_VARS)) {
    log(colorize(`📋 ${category.toUpperCase()} Configuration:`, 'bright'));

    for (const varName of vars) {
      const value = process.env[varName];

      if (!value || value.trim() === '') {
        logError(`${varName} is required but not set`);
        hasErrors = true;
        continue;
      }

      // Perform specific validations
      let isValid = true;

      switch (varName) {
        case 'SUPABASE_URL':
        case 'LNBITS_API_URL':
          isValid = validateUrl(value, varName);
          break;

        case 'PORT':
          isValid = validatePort(value, varName);
          break;

        case 'JWT_SECRET':
          isValid = validateJWTSecret(value, isProduction);
          break;

        case 'SESSION_SECRET':
          if (value.length < (isProduction ? 64 : 32)) {
            logError(`SESSION_SECRET must be at least ${isProduction ? 64 : 32} characters`);
            isValid = false;
          }
          break;

        case 'NOSTR_RELAYS':
          isValid = validateNostrRelays(value);
          break;
      }

      if (!isValid) {
        hasErrors = true;
      } else {
        logSuccess(`${varName} ✓`);
      }
    }
    log('');
  }

  // Check production-specific requirements
  if (isProduction) {
    log(colorize('🚀 PRODUCTION Configuration:', 'bright'));

    for (const varName of PRODUCTION_REQUIRED_VARS) {
      const value = process.env[varName];

      if (!value || value.trim() === '') {
        logError(`${varName} is required in production but not set`);
        hasErrors = true;
        continue;
      }

      // Perform specific validations
      let isValid = true;

      switch (varName) {
        case 'SENTRY_DSN':
        case 'CORS_ORIGIN':
          isValid = validateUrl(value, varName);
          break;

        case 'SSL_EMAIL':
          isValid = validateEmail(value, varName);
          break;
      }

      if (!isValid) {
        hasErrors = true;
      } else {
        logSuccess(`${varName} ✓`);
      }
    }
    log('');
  }

  // Check Lightning Network configuration
  const lightningMin = process.env.LIGHTNING_MIN_AMOUNT;
  const lightningMax = process.env.LIGHTNING_MAX_AMOUNT;

  if (lightningMin && lightningMax) {
    if (!validateLightningAmounts(lightningMin, lightningMax)) {
      hasErrors = true;
    } else {
      logSuccess('Lightning Network amounts configuration ✓');
    }
  }

  // Check for potentially insecure configurations
  log(colorize('🔒 Security Checks:', 'bright'));

  const jwtSecret = process.env.JWT_SECRET;
  if ((jwtSecret && jwtSecret.includes('change-this')) || jwtSecret.includes('secret')) {
    logWarning('JWT_SECRET appears to contain default/insecure values');
    hasWarnings = true;
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (
    sessionSecret &&
    (sessionSecret.includes('change-this') || sessionSecret.includes('secret'))
  ) {
    logWarning('SESSION_SECRET appears to contain default/insecure values');
    hasWarnings = true;
  }

  if (isProduction && process.env.DEBUG_ENABLED === 'true') {
    logWarning('DEBUG_ENABLED is true in production - consider disabling for security');
    hasWarnings = true;
  }

  if (!hasWarnings) {
    logSuccess('Security configuration ✓');
  }
  log('');

  // Feature flags summary
  log(colorize('🚩 Feature Flags:', 'bright'));
  const featureFlags = [
    'FEATURE_LIGHTNING_PAYMENTS',
    'FEATURE_AI_CONTENT_GENERATION',
    'FEATURE_NOSTR_PUBLISHING',
    'FEATURE_CONTENT_MONETIZATION',
    'FEATURE_PREMIUM_SUBSCRIPTIONS',
  ];

  for (const flag of featureFlags) {
    const value = process.env[flag];
    const isEnabled = value === 'true' || value === '1';
    const status = isEnabled ? colorize('ENABLED', 'green') : colorize('DISABLED', 'yellow');
    log(`${flag}: ${status}`);
  }
  log('');

  // Final summary
  log(colorize('📊 Validation Summary:', 'bright'));
  log('====================');

  if (hasErrors) {
    logError('Environment validation FAILED');
    logError('Please fix the errors above before proceeding');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('Environment validation completed with warnings');
    logWarning('Consider addressing the warnings above');
    logSuccess('Environment is valid but could be improved');
  } else {
    logSuccess('Environment validation PASSED');
    logSuccess('All required variables are properly configured');
  }

  log('');
}

// Check if dotenv is available
try {
  require('dotenv');
} catch (error) {
  logError('dotenv package is required but not installed');
  logInfo('Install it with: npm install dotenv');
  process.exit(1);
}

// Run validation if called directly
if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
