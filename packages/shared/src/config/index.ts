/**
 * Shared Configuration Exports
 * Environment validation and configuration utilities
 */

// Export environment validator types and functions
export {
  EnvironmentValidator,
  VALIDATION_RULES,
  validateEnvironmentOnStartup,
  getValidatedConfig,
  getRequiredEnvVar,
  getEnvVar,
  logger,
  type ValidationRule,
  type ValidationError,
  type ValidationResult,
  type EnvVarValue,
} from './environment-validator';

// Export environment configs
export * from './environment-configs';

// Export environment types and functions (renamed to avoid conflicts)
export {
  type EnvironmentConfig,
  validateEnvironment,
  loadEnvironment,
  isProduction,
  isDevelopment,
  isTest,
  getDatabaseConfig,
  getLightningConfig,
  getNostrConfig,
  getConfig,
  resetConfig,
  // Note: isFeatureEnabled from environment.ts is not exported to avoid conflict
  // Use isFeatureEnabled from environment-validator.ts instead
} from './environment';

// Export relay configuration
export {
  RelayConfig,
  getRelayUrls,
  getRelays,
  getReadRelays,
  getWriteRelays,
  DEFAULT_RELAYS_LEGACY,
} from './relay-config';
