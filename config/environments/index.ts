/**
 * Environment Configuration Module
 *
 * Exports the appropriate configuration based on NODE_ENV or VITE_ENV
 *
 * Usage:
 *   import config from '@/config/environments';
 *   console.log(config.api.url);
 */

import { developmentConfig } from './development';
import { stagingConfig } from './staging';
import { productionConfig } from './production';

export type { EnvironmentConfig } from './development';

/**
 * Get the current environment name
 */
export const getEnvironment = (): 'development' | 'staging' | 'production' => {
  // Check Vite environment first (for frontend)
  const viteEnv = import.meta.env?.VITE_ENV || import.meta.env?.MODE;

  // Check Node environment (for backend)
  const nodeEnv = process.env.NODE_ENV;

  const env = (viteEnv || nodeEnv || 'development').toLowerCase();

  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
};

/**
 * Get the configuration for the current environment
 */
export const getConfig = () => {
  const environment = getEnvironment();

  switch (environment) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'development':
    default:
      return developmentConfig;
  }
};

/**
 * Current environment configuration
 */
const config = getConfig();

export default config;

/**
 * Export individual environment configs for testing
 */
export { developmentConfig, stagingConfig, productionConfig };

/**
 * Validation helper to ensure required environment variables are set
 */
export const validateEnvironmentConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check required environment variables based on environment
  const env = getEnvironment();

  if (env === 'production' || env === 'staging') {
    if (!config.api.url) {
      errors.push(`API URL not configured for ${env}`);
    }

    if (!config.redis.url) {
      errors.push(`Redis URL not configured for ${env}`);
    }

    if (env === 'production') {
      if (!config.security.secureCookies) {
        errors.push('Secure cookies must be enabled in production');
      }

      if (config.features.enableDebugTools) {
        errors.push('Debug tools must be disabled in production');
      }

      if (config.logging.level !== 'error') {
        errors.push('Production logging level should be "error"');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Log current environment configuration (non-sensitive info only)
 */
export const logEnvironmentInfo = () => {
  console.log('='.repeat(60));
  console.log('SOVREN ENVIRONMENT CONFIGURATION');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.environment}`);
  console.log(`API URL: ${config.api.url}`);
  console.log(`Logging Level: ${config.logging.level}`);
  console.log(`Beta Features: ${config.features.enableBeta ? 'Enabled' : 'Disabled'}`);
  console.log(`Debug Tools: ${config.features.enableDebugTools ? 'Enabled' : 'Disabled'}`);
  console.log(`CDN: ${(config as any).cdn?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('='.repeat(60));

  // Validate configuration
  const validation = validateEnvironmentConfig();
  if (!validation.valid) {
    console.error('❌ Configuration errors detected:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log('✅ Configuration validated successfully');
  }
  console.log('='.repeat(60));
};
