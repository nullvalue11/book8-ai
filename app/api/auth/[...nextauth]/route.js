/* eslint-disable no-restricted-syntax */
/**
 * NextAuth.js API Route (App Router)
 * 
 * This file uses direct process.env access because NextAuth requires
 * environment variables at initialization time.
 */
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// Force Node.js runtime (not Edge) and dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Direct env access for NextAuth
const getEnv = (key, fallback = '') => process.env[key] || fallback

// Debug logging control - only log verbose info when DEBUG_LOGS=true
const DEBUG_LOGS = getEnv('DEBUG_LOGS', 'false').toLowerCase() === 'true'
const debugLog = (...args) => DEBUG_LOGS && console.log(...args)

// Validate and log OAuth configuration on module load
const googleClientId = getEnv('GOOGLE_CLIENT_ID')
const googleClientSecret = getEnv('GOOGLE_CLIENT_SECRET')
const azureClientId = getEnv('AZURE_AD_CLIENT_ID')
const azureClientSecret = getEnv('AZURE_AD_CLIENT_SECRET')
const azureTenantId = getEnv('AZURE_AD_TENANT_ID', 'common')
const nextAuthUrl = getEnv('NEXTAUTH_URL')
const nextAuthSecret = getEnv('NEXTAUTH_SECRET') || getEnv('JWT_SECRET')

// Configuration logging (only when DEBUG_LOGS=true)
debugLog('[NextAuth] ====== CONFIGURATION CHECK ======')
debugLog('[NextAuth] NEXTAUTH_URL:', nextAuthUrl || 'NOT SET ❌')
debugLog('[NextAuth] NEXTAUTH_SECRET:', nextAuthSecret ? 'SET ✓' : 'NOT SET ❌')
debugLog('[NextAuth] GOOGLE_CLIENT_ID:', googleClientId ? `${googleClientId.substring(0, 20)}... ✓` : 'NOT SET ❌')
debugLog('[NextAuth] GOOGLE_CLIENT_SECRET:', googleClientSecret ? 'SET ✓' : 'NOT SET ❌')
debugLog('[NextAuth] AZURE_AD_CLIENT_ID:', azureClientId ? `${azureClientId.substring(0, 20)}... ✓` : 'NOT SET ❌')
debugLog('[NextAuth] AZURE_AD_CLIENT_SECRET:', azureClientSecret ? 'SET ✓' : 'NOT SET ❌')
debugLog('[NextAuth] AZURE_AD_TENANT_ID:', azureTenantId)
debugLog('[NextAuth] NODE_ENV:', getEnv('NODE_ENV', 'development'))
debugLog('[NextAuth] =====================================')

// Validate critical config - errors always logged
if (!nextAuthUrl) {
  console.error('[NextAuth] CRITICAL: NEXTAUTH_URL is not set!')
}
if (!nextAuthSecret) {
  console.error('[NextAuth] CRITICAL: NEXTAUTH_SECRET is not set!')
}

// MongoDB connection
let client
let db

async function connectToMongo() {
  if (!client) {
    const mongoUrl = getEnv('MONGO_URL')
    const dbName = getEnv('DB_NAME')
    if (!mongoUrl) throw new Error('MONGO_URL missing')
    if (!dbName) throw new Error('DB_NAME missing')
    client = new MongoClient(mongoUrl)
    await client.connect()
    db = client.db(dbName)
  }
  return db
}

// Build providers array with validation
const providers = []

// Only add Google provider if credentials exist
if (googleClientId && googleClientSecret) {
  debugLog('[NextAuth] Adding Google provider')
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    })
  )
} else {
  debugLog('[NextAuth] Skipping Google provider - missing credentials')
}

// Only add Azure AD provider if credentials exist
if (azureClientId && azureClientSecret) {
  debugLog('[NextAuth] Adding Azure AD provider')
  providers.push(
    AzureADProvider({
      clientId: azureClientId,
      clientSecret: azureClientSecret,
      tenantId: azureTenantId,
    })
  )
} else {
  debugLog('[NextAuth] Skipping Azure AD provider - missing credentials')
}

// Always add credentials provider
providers.push(
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials) {
      debugLog('[NextAuth] Credentials authorize attempt for:', credentials?.email)
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      try {
        const database = await connectToMongo()
        const user = await database.collection('users').findOne({ 
          email: String(credentials.email).toLowerCase() 
        })

        if (!user || !user.passwordHash) {
          debugLog('[NextAuth] User not found or no password hash')
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          debugLog('[NextAuth] Invalid password')
          return null
        }

        debugLog('[NextAuth] Credentials auth successful for:', user.email)
        return {
          id: user.id,
          email: user.email,
          name: user.name || '',
          subscription: user.subscription,
        }
      } catch (error) {
        console.error('[NextAuth] Credentials authorize error:', error)
        return null
      }
    }
  })
)

debugLog('[NextAuth] Total providers configured:', providers.length)

const authOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      debugLog('[NextAuth] ====== SIGNIN CALLBACK ======')
      debugLog('[NextAuth] Provider:', account?.provider)
      debugLog('[NextAuth] User email:', user?.email)
      debugLog('[NextAuth] Account type:', account?.type)
      debugLog('[NextAuth] Has profile:', !!profile)
      debugLog('[NextAuth] =============================')

      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        try {
          const database = await connectToMongo()
          const userEmail = user.email?.toLowerCase()
          
          if (!userEmail) {
            console.error('[NextAuth] No email from OAuth provider')
            return false
          }

          let existingUser = await database.collection('users').findOne({ email: userEmail })

          if (existingUser) {
            debugLog('[NextAuth] Updating existing user:', userEmail)
            const updateField = account.provider === 'google' 
              ? { 'oauthProviders.google': { id: user.id, connectedAt: new Date() } }
              : { 'oauthProviders.microsoft': { id: user.id, connectedAt: new Date() } }
            
            await database.collection('users').updateOne(
              { email: userEmail },
              { 
                $set: {
                  ...updateField,
                  lastLogin: new Date(),
                  name: existingUser.name || user.name || profile?.name || ''
                }
              }
            )
          } else {
            debugLog('[NextAuth] Creating new user:', userEmail)
            const newUser = {
              id: uuidv4(),
              email: userEmail,
              name: user.name || profile?.name || '',
              passwordHash: null,
              createdAt: new Date(),
              lastLogin: new Date(),
              subscription: null,
              google: account.provider === 'google' ? { connected: false, refreshToken: null } : null,
              oauthProviders: {
                [account.provider === 'google' ? 'google' : 'microsoft']: {
                  id: user.id,
                  connectedAt: new Date()
                }
              }
            }
            await database.collection('users').insertOne(newUser)
          }
          debugLog('[NextAuth] SignIn successful for:', userEmail)
          return true
        } catch (error) {
          console.error('[NextAuth] signIn callback error:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        console.log('[NextAuth] JWT callback - new sign in from:', account.provider)
        token.provider = account.provider
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        
        if (account.provider === 'google' || account.provider === 'azure-ad') {
          try {
            const database = await connectToMongo()
            const dbUser = await database.collection('users').findOne({ 
              email: user.email?.toLowerCase() 
            })
            if (dbUser) {
              token.userId = dbUser.id
              token.subscription = dbUser.subscription
            }
          } catch (error) {
            console.error('[NextAuth] jwt callback error:', error)
          }
        } else {
          token.subscription = user.subscription
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId
        session.user.email = token.email
        session.user.name = token.name
        session.user.subscription = token.subscription
        session.provider = token.provider
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      console.log('[NextAuth] Redirect callback - url:', url, 'baseUrl:', baseUrl)
      
      // Simplified redirect callback - let NextAuth handle OAuth flow naturally
      // After OAuth completion, NextAuth redirects to baseUrl by default
      // We redirect to /auth/oauth-callback to sync NextAuth session with custom JWT
      
      
          // Handle error redirects - preserve error URLs
          if (url.includes('/auth/error')) {
                  console.log('[NextAuth] Preserving error redirect:', url)
                  if (url.startsWith('/')) {
                            return `${baseUrl}${url}`
                          }
                  return url
                }
      // Handle relative URLs - convert to absolute
      if (url.startsWith('/')) {
        // After OAuth completion, NextAuth redirects to baseUrl (which becomes '/')
        // Redirect OAuth users to our custom callback page for JWT sync
        if (url === '/' || url === '') {
          return `${baseUrl}/auth/oauth-callback`
        }
        return `${baseUrl}${url}`
      }
      
      // Handle absolute URLs on the same origin
      if (url.startsWith(baseUrl)) {
        // If redirecting to baseUrl after OAuth, redirect to callback page
        if (url === baseUrl || url === `${baseUrl}/`) {
          return `${baseUrl}/auth/oauth-callback`
        }
        return url
      }
      
      // Default: return baseUrl (NextAuth will handle external redirects)
      return baseUrl
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[NextAuth] EVENT signIn:', { 
        provider: account?.provider, 
        email: user?.email,
        isNewUser 
      })
    },
    async signOut({ token }) {
      console.log('[NextAuth] EVENT signOut')
    },
    async createUser({ user }) {
      console.log('[NextAuth] EVENT createUser:', user?.email)
    },
    async linkAccount({ user, account, profile }) {
      console.log('[NextAuth] EVENT linkAccount:', { 
        provider: account?.provider, 
        email: user?.email 
      })
    },
    async session({ session, token }) {
      // Session accessed
    }
  },
  logger: {
    error(code, metadata) {
      console.error('[NextAuth] ====== ERROR ======')
      console.error('[NextAuth] Error code:', code)
      console.error('[NextAuth] Error metadata:', JSON.stringify(metadata, null, 2))
      console.error('[NextAuth] ==================')
    },
    warn(code, metadata) {
      console.warn('[NextAuth] WARN:', code, metadata ? JSON.stringify(metadata) : '')
    },
    debug(code, metadata) {
      console.log('[NextAuth] DEBUG:', code, metadata ? JSON.stringify(metadata) : '')
    }
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: nextAuthSecret,
  debug: true, // Enable debug mode to see more logs
}

// Add logging for provider availability
console.log('[NextAuth] ====== PROVIDER STATUS ======')
console.log('[NextAuth] Total providers:', providers.length)
providers.forEach((provider, index) => {
  const providerId = provider.id || provider.name || 'unknown'
  console.log(`[NextAuth] Provider ${index + 1}: ${providerId}`)
  // Log provider type for debugging
  if (provider.type) {
    console.log(`[NextAuth] Provider ${index + 1} type: ${provider.type}`)
  }
})
console.log('[NextAuth] NEXTAUTH_URL:', nextAuthUrl)
console.log('[NextAuth] ============================')

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
