/**
 * Unit tests for env.js module
 * Ensures environment configuration is properly structured
 */

const { env, debugLog, isFeatureEnabled } = require('../app/lib/env');

describe('Environment Configuration', () => {
  test('env module exports configuration object', () => {
    expect(env).toBeDefined();
    expect(typeof env).toBe('object');
  });

  test('env exposes required core keys', () => {
    // Core
    expect(env).toHaveProperty('NODE_ENV');
    expect(env).toHaveProperty('IS_PRODUCTION');
    expect(env).toHaveProperty('IS_DEVELOPMENT');
    expect(env).toHaveProperty('BASE_URL');
    
    // Database
    expect(env).toHaveProperty('MONGO_URL');
    expect(env).toHaveProperty('DB_NAME');
    
    // Auth
    expect(env).toHaveProperty('JWT_SECRET');
    expect(env).toHaveProperty('RESET_TOKEN_SECRET');
    expect(env).toHaveProperty('RESET_TOKEN_TTL_MINUTES');
    
    // Features
    expect(env).toHaveProperty('FEATURES');
    expect(env.FEATURES).toHaveProperty('RESCHEDULE');
    expect(env.FEATURES).toHaveProperty('GUEST_TZ');
    
    // Debug
    expect(env).toHaveProperty('DEBUG_LOGS');
  });

  test('env does NOT expose raw process.env', () => {
    // Ensure we're not just passing through process.env
    expect(env).not.toHaveProperty('PATH');
    expect(env).not.toHaveProperty('HOME');
    expect(env).not.toHaveProperty('USER');
  });

  test('debugLog function exists and is callable', () => {
    expect(typeof debugLog).toBe('function');
    // Should not throw
    expect(() => debugLog('test message')).not.toThrow();
  });

  test('isFeatureEnabled function works correctly', () => {
    expect(typeof isFeatureEnabled).toBe('function');
    expect(typeof isFeatureEnabled('RESCHEDULE')).toBe('boolean');
    expect(typeof isFeatureEnabled('GUEST_TZ')).toBe('boolean');
  });

  test('environment values are properly typed', () => {
    expect(typeof env.NODE_ENV).toBe('string');
    expect(typeof env.IS_PRODUCTION).toBe('boolean');
    expect(typeof env.IS_DEVELOPMENT).toBe('boolean');
    expect(typeof env.BASE_URL).toBe('string');
    expect(typeof env.MONGO_URL).toBe('string');
    expect(typeof env.DB_NAME).toBe('string');
    expect(typeof env.JWT_SECRET).toBe('string');
    expect(typeof env.RESET_TOKEN_TTL_MINUTES).toBe('number');
    expect(typeof env.DEBUG_LOGS).toBe('boolean');
  });

  test('optional services have correct shape', () => {
    // Google can be null or an object
    if (env.GOOGLE) {
      expect(env.GOOGLE).toHaveProperty('CLIENT_ID');
      expect(env.GOOGLE).toHaveProperty('CLIENT_SECRET');
      expect(env.GOOGLE).toHaveProperty('REDIRECT_URI');
    }
    
    // Stripe can be null or an object
    if (env.STRIPE) {
      expect(env.STRIPE).toHaveProperty('SECRET_KEY');
      expect(env.STRIPE).toHaveProperty('PUBLISHABLE_KEY');
      expect(env.STRIPE).toHaveProperty('WEBHOOK_SECRET');
    }
  });

  test('no direct process.env calls in env module', () => {
    const fs = require('fs');
    const path = require('path');
    const envFilePath = path.join(__dirname, '../app/lib/env.js');
    const envFileContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Count process.env occurrences (they should only be in getEnvVar function)
    const processEnvMatches = envFileContent.match(/process\.env/g) || [];
    
    // Should have minimal process.env references (only in getEnvVar and validation)
    expect(processEnvMatches.length).toBeLessThan(5);
  });
});
