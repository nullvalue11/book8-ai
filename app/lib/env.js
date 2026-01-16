/**
 * Environment Configuration with Fail-Fast Validation
 * 
 * This module validates all required environment variables at boot time
 * and exports a typed configuration object.
 * 
 * @throws {Error} If any required environment variable is missing or invalid
 */

class EnvValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

/**
 * Get environment variable with validation
 * @param {string} key - Environment variable name
 * @param {boolean} required - Whether this variable is required
 * @param {*} defaultValue - Default value if not required
 * @returns {string|undefined}
 */
function getEnvVar(key, required = true, defaultValue = undefined) {
  const value = process.env[key]
  
  if (required && !value) {
    throw new EnvValidationError(
      `Missing required environment variable: ${key}\n` +
      `Please set ${key} in your .env file or environment.\n` +
      `See .env.example for reference.`
    )
  }
  
  return value || defaultValue
}

/**
 * Validate URL format
 * @param {string} url
 * @param {string} name
 */
function validateUrl(url, name) {
  try {
    new URL(url)
  } catch (error) {
    throw new EnvValidationError(
      `Invalid URL format for ${name}: ${url}\n` +
      `Must be a valid HTTP/HTTPS URL.`
    )
  }
}

/**
 * Validate and load environment configuration
 */
function loadConfig() {
  console.log('[env] Loading and validating environment configuration...')
  
  try {
    // Core Application
    const NODE_ENV = getEnvVar('NODE_ENV', false, 'development')
    const NEXT_PUBLIC_BASE_URL = getEnvVar('NEXT_PUBLIC_BASE_URL', true)
    
    // Validate base URL format
    validateUrl(NEXT_PUBLIC_BASE_URL, 'NEXT_PUBLIC_BASE_URL')
    
    // Database
    const MONGO_URL = getEnvVar('MONGO_URL', true)
    const DB_NAME = getEnvVar('DB_NAME', false, 'book8')
    
    // Authentication
    const JWT_SECRET = getEnvVar('JWT_SECRET', true)
    const RESET_TOKEN_SECRET = getEnvVar('RESET_TOKEN_SECRET', false, JWT_SECRET)
    const RESET_TOKEN_TTL_MINUTES = parseInt(getEnvVar('RESET_TOKEN_TTL_MINUTES', false, '30'), 10)
    
    // NextAuth.js
    const NEXTAUTH_SECRET = getEnvVar('NEXTAUTH_SECRET', false, JWT_SECRET)
    const NEXTAUTH_URL = getEnvVar('NEXTAUTH_URL', false, NEXT_PUBLIC_BASE_URL)
    
    // Microsoft Azure AD OAuth
    const AZURE_AD_CLIENT_ID = getEnvVar('AZURE_AD_CLIENT_ID', false)
    const AZURE_AD_CLIENT_SECRET = getEnvVar('AZURE_AD_CLIENT_SECRET', false)
    const AZURE_AD_TENANT_ID = getEnvVar('AZURE_AD_TENANT_ID', false, 'common')
    
    if (JWT_SECRET.length < 32) {
      console.warn('[env] WARNING: JWT_SECRET should be at least 32 characters for security')
    }
    
    // Google OAuth & Calendar
    const GOOGLE_CLIENT_ID = getEnvVar('GOOGLE_CLIENT_ID', false)
    const GOOGLE_CLIENT_SECRET = getEnvVar('GOOGLE_CLIENT_SECRET', false)
    const GOOGLE_REDIRECT_URI = getEnvVar('GOOGLE_REDIRECT_URI', false)
    
    if (GOOGLE_REDIRECT_URI) {
      validateUrl(GOOGLE_REDIRECT_URI, 'GOOGLE_REDIRECT_URI')
    }
    
    const hasGoogleOAuth = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI
    const hasGoogleCredentials = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    if (!hasGoogleCredentials && NODE_ENV === 'production') {
      console.warn('[env] WARNING: Google OAuth not configured. Calendar and social login features will be disabled.')
    }
    
    // Email Service (Resend)
    const RESEND_API_KEY = getEnvVar('RESEND_API_KEY', false)
    const EMAIL_FROM = getEnvVar('EMAIL_FROM', false, 'Book8 <onboarding@resend.dev>')
    const EMAIL_REPLY_TO = getEnvVar('EMAIL_REPLY_TO', false, 'support@book8.ai')
    
    if (!RESEND_API_KEY && NODE_ENV === 'production') {
      console.warn('[env] WARNING: RESEND_API_KEY not set. Email notifications will be disabled.')
    }
    
    // Stripe (Payment Processing)
    const STRIPE_SECRET_KEY = getEnvVar('STRIPE_SECRET_KEY', false)
    const STRIPE_PUBLISHABLE_KEY = getEnvVar('STRIPE_PUBLISHABLE_KEY', false)
    const STRIPE_WEBHOOK_SECRET = getEnvVar('STRIPE_WEBHOOK_SECRET', false)
    
    // Stripe Price IDs
    const STRIPE_PRICE_STARTER = getEnvVar('STRIPE_PRICE_STARTER', false)
    const STRIPE_PRICE_GROWTH = getEnvVar('STRIPE_PRICE_GROWTH', false)
    const STRIPE_PRICE_ENTERPRISE = getEnvVar('STRIPE_PRICE_ENTERPRISE', false)
    const STRIPE_PRICE_CALL_MINUTE_METERED = getEnvVar('STRIPE_PRICE_CALL_MINUTE_METERED', false)
    
    // Admin Token for protected endpoints
    const ADMIN_TOKEN = getEnvVar('ADMIN_TOKEN', false)
    
    // Ops Control Plane Internal Secret (legacy)
    const OPS_INTERNAL_SECRET = getEnvVar('OPS_INTERNAL_SECRET', false)
    
    // Ops Control Plane Scoped API Keys (v1.3.0+)
    const OPS_KEY_N8N = getEnvVar('OPS_KEY_N8N', false)
    const OPS_KEY_ADMIN = getEnvVar('OPS_KEY_ADMIN', false)
    
    // Ops Console (Basic Auth for /ops/* routes)
    const OPS_CONSOLE_USER = getEnvVar('OPS_CONSOLE_USER', false, 'admin')
    const OPS_CONSOLE_PASS = getEnvVar('OPS_CONSOLE_PASS', false, 'changeme')
    const OPS_INTERNAL_BASE_URL = getEnvVar('OPS_INTERNAL_BASE_URL', false, 'http://localhost:3000')
    
    // Billing/Usage Reporting (uses existing CRON_SECRET for auth)
    const CORE_API_BASE_URL = getEnvVar('CORE_API_BASE_URL', false)
    const CORE_API_INTERNAL_SECRET = getEnvVar('CORE_API_INTERNAL_SECRET', false)
    const BILLING_TIMEZONE = getEnvVar('BILLING_TIMEZONE', false, 'UTC')
    
    const hasStripe = STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY && STRIPE_WEBHOOK_SECRET
    if (!hasStripe && NODE_ENV === 'production') {
      console.warn('[env] WARNING: Stripe not configured. Billing features will be disabled.')
    }
    
    // Optional Services
    const TAVILY_API_KEY = getEnvVar('TAVILY_API_KEY', false)
    const CRON_SECRET = getEnvVar('CRON_SECRET', false)
    
    // Feature Flags
    const FEATURE_RESCHEDULE = getEnvVar('FEATURE_RESCHEDULE', false, 'true') === 'true'
    const FEATURE_GUEST_TZ = getEnvVar('FEATURE_GUEST_TZ', false, 'true') === 'true'
    const FEATURE_REMINDERS = getEnvVar('FEATURE_REMINDERS', false, 'true') === 'true'
    const FEATURE_ASSISTANT = getEnvVar('FEATURE_ASSISTANT', false, 'false') === 'true'
    const FEATURE_ASSISTANT_LLM = getEnvVar('FEATURE_ASSISTANT_LLM', false, 'false') === 'true'
    
    // Debug & Development
    const DEBUG_LOGS = getEnvVar('DEBUG_LOGS', false, 'false') === 'true'
    
    // Vercel Build Info (for deployment tracking)
    const VERCEL_GIT_COMMIT_SHA = getEnvVar('VERCEL_GIT_COMMIT_SHA', false, 'local')
    
    if (DEBUG_LOGS && NODE_ENV === 'production') {
      console.warn('[env] WARNING: DEBUG_LOGS is enabled in production. This may expose sensitive data.')
    }
    
    // Build configuration object
    const config = {
      // Environment
      NODE_ENV,
      IS_PRODUCTION: NODE_ENV === 'production',
      IS_DEVELOPMENT: NODE_ENV === 'development',
      
      // URLs
      BASE_URL: NEXT_PUBLIC_BASE_URL,
      
      // Database
      MONGO_URL,
      DB_NAME,
      
      // Auth
      JWT_SECRET,
      RESET_TOKEN_SECRET,
      RESET_TOKEN_TTL_MINUTES: isNaN(RESET_TOKEN_TTL_MINUTES) ? 30 : Math.max(5, Math.min(RESET_TOKEN_TTL_MINUTES, 120)),
      
      // NextAuth.js
      NEXTAUTH_SECRET,
      NEXTAUTH_URL,
      
      // Microsoft Azure AD
      AZURE_AD: AZURE_AD_CLIENT_ID && AZURE_AD_CLIENT_SECRET ? {
        CLIENT_ID: AZURE_AD_CLIENT_ID,
        CLIENT_SECRET: AZURE_AD_CLIENT_SECRET,
        TENANT_ID: AZURE_AD_TENANT_ID
      } : null,
      
      // Azure AD credentials directly (for NextAuth)
      AZURE_AD_CLIENT_ID: AZURE_AD_CLIENT_ID || null,
      AZURE_AD_CLIENT_SECRET: AZURE_AD_CLIENT_SECRET || null,
      AZURE_AD_TENANT_ID: AZURE_AD_TENANT_ID || 'common',
      
      // Google
      // Google (for Calendar integration - requires redirect URI)
      GOOGLE: hasGoogleOAuth ? {
        CLIENT_ID: GOOGLE_CLIENT_ID,
        CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
        REDIRECT_URI: GOOGLE_REDIRECT_URI
      } : null,
      
      // Google credentials (for NextAuth - just needs client ID and secret)
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID || null,
      GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET || null,
      
      // Email
      RESEND_API_KEY,
      EMAIL_FROM,
      EMAIL_REPLY_TO,
      
      // Stripe
      STRIPE: hasStripe ? {
        SECRET_KEY: STRIPE_SECRET_KEY,
        PUBLISHABLE_KEY: STRIPE_PUBLISHABLE_KEY,
        WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET,
        PRICE_STARTER: STRIPE_PRICE_STARTER,
        PRICE_GROWTH: STRIPE_PRICE_GROWTH,
        PRICE_ENTERPRISE: STRIPE_PRICE_ENTERPRISE,
        PRICE_CALL_MINUTE_METERED: STRIPE_PRICE_CALL_MINUTE_METERED
      } : null,
      
      // Admin
      ADMIN_TOKEN,
      
      // Ops Control Plane
      OPS_INTERNAL_SECRET,
      OPS_KEY_N8N,
      OPS_KEY_ADMIN,
      OPS_CONSOLE_USER,
      OPS_CONSOLE_PASS,
      OPS_INTERNAL_BASE_URL,
      
      // n8n Webhooks
      N8N_BUSINESS_PROVISIONED_WEBHOOK_URL: getEnvVar('N8N_BUSINESS_PROVISIONED_WEBHOOK_URL', false),
      
      // Billing/Usage Reporting
      CORE_API_BASE_URL,
      CORE_API_INTERNAL_SECRET,
      BILLING_TIMEZONE,
      
      // Optional
      TAVILY_API_KEY,
      CRON_SECRET,
      
      // Features
      FEATURES: {
        RESCHEDULE: FEATURE_RESCHEDULE,
        GUEST_TZ: FEATURE_GUEST_TZ,
        REMINDERS: FEATURE_REMINDERS,
        ASSISTANT: FEATURE_ASSISTANT,
        ASSISTANT_LLM: FEATURE_ASSISTANT_LLM
      },
      
      // Debug
      DEBUG_LOGS,
      
      // Vercel Build Info
      VERCEL_GIT_COMMIT_SHA
    }
    
    console.log('[env] ✅ Environment validation successful')
    console.log('[env] Configuration loaded:', {
      NODE_ENV: config.NODE_ENV,
      BASE_URL: config.BASE_URL,
      DATABASE: config.DB_NAME,
      GOOGLE_OAUTH: !!config.GOOGLE,
      RESEND: !!config.RESEND_API_KEY,
      STRIPE: !!config.STRIPE,
      TAVILY: !!config.TAVILY_API_KEY,
      DEBUG_LOGS: config.DEBUG_LOGS
    })
    
    return config
    
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error('\n❌ ENVIRONMENT VALIDATION FAILED\n')
      console.error(error.message)
      console.error('\n')
      
      if (process.env.NODE_ENV === 'production') {
        // In production, we must fail fast
        process.exit(1)
      } else {
        // In development, throw the error
        throw error
      }
    }
    throw error
  }
}

// Load and validate configuration at module import time
const env = loadConfig()

// Export configuration
export { env }

// Helper function for debug logging
export function debugLog(...args) {
  if (env.DEBUG_LOGS) {
    console.log('[DEBUG]', ...args)
  }
}

// Helper to check if a feature is enabled
export function isFeatureEnabled(featureName) {
  return env.FEATURES[featureName] === true
}
