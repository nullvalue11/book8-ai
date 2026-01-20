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

// Validate and log OAuth configuration on module load
const googleClientId = getEnv('GOOGLE_CLIENT_ID')
const googleClientSecret = getEnv('GOOGLE_CLIENT_SECRET')
const azureClientId = getEnv('AZURE_AD_CLIENT_ID')
const azureClientSecret = getEnv('AZURE_AD_CLIENT_SECRET')
const azureTenantId = getEnv('AZURE_AD_TENANT_ID', 'common')
const nextAuthUrl = getEnv('NEXTAUTH_URL')
const nextAuthSecret = getEnv('NEXTAUTH_SECRET') || getEnv('JWT_SECRET')

// Detailed configuration logging
console.log('[NextAuth] ====== CONFIGURATION CHECK ======')
console.log('[NextAuth] NEXTAUTH_URL:', nextAuthUrl || 'NOT SET ❌')
console.log('[NextAuth] NEXTAUTH_SECRET:', nextAuthSecret ? 'SET ✓' : 'NOT SET ❌')
console.log('[NextAuth] GOOGLE_CLIENT_ID:', googleClientId ? `${googleClientId.substring(0, 20)}... ✓` : 'NOT SET ❌')
console.log('[NextAuth] GOOGLE_CLIENT_SECRET:', googleClientSecret ? 'SET ✓' : 'NOT SET ❌')
console.log('[NextAuth] AZURE_AD_CLIENT_ID:', azureClientId ? `${azureClientId.substring(0, 20)}... ✓` : 'NOT SET ❌')
console.log('[NextAuth] AZURE_AD_CLIENT_SECRET:', azureClientSecret ? 'SET ✓' : 'NOT SET ❌')
console.log('[NextAuth] AZURE_AD_TENANT_ID:', azureTenantId)
console.log('[NextAuth] NODE_ENV:', getEnv('NODE_ENV', 'development'))
console.log('[NextAuth] =====================================')

// Validate critical config
if (!nextAuthUrl) {
  console.error('[NextAuth] CRITICAL: NEXTAUTH_URL is not set!')
}
if (!nextAuthSecret) {
  console.error('[NextAuth] CRITICAL: NEXTAUTH_SECRET is not set!')
}
if (!googleClientId || !googleClientSecret) {
  console.error('[NextAuth] WARNING: Google OAuth credentials missing - Google login will fail')
}
if (!azureClientId || !azureClientSecret) {
  console.error('[NextAuth] WARNING: Azure AD credentials missing - Microsoft login will fail')
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
  console.log('[NextAuth] Adding Google provider')
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
  console.warn('[NextAuth] Skipping Google provider - missing credentials')
}

// Only add Azure AD provider if credentials exist
if (azureClientId && azureClientSecret) {
  console.log('[NextAuth] Adding Azure AD provider')
  providers.push(
    AzureADProvider({
      clientId: azureClientId,
      clientSecret: azureClientSecret,
      tenantId: azureTenantId,
    })
  )
} else {
  console.warn('[NextAuth] Skipping Azure AD provider - missing credentials')
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
      console.log('[NextAuth] Credentials authorize attempt for:', credentials?.email)
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      try {
        const database = await connectToMongo()
        const user = await database.collection('users').findOne({ 
          email: String(credentials.email).toLowerCase() 
        })

        if (!user || !user.passwordHash) {
          console.log('[NextAuth] User not found or no password hash')
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          console.log('[NextAuth] Invalid password')
          return null
        }

        console.log('[NextAuth] Credentials auth successful for:', user.email)
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

console.log('[NextAuth] Total providers configured:', providers.length)

const authOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log('[NextAuth] ====== SIGNIN CALLBACK ======')
      console.log('[NextAuth] Provider:', account?.provider)
      console.log('[NextAuth] User email:', user?.email)
      console.log('[NextAuth] Account type:', account?.type)
      console.log('[NextAuth] Has profile:', !!profile)
      console.log('[NextAuth] =============================')

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
            console.log('[NextAuth] Updating existing user:', userEmail)
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
            console.log('[NextAuth] Creating new user:', userEmail)
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
          console.log('[NextAuth] SignIn successful for:', userEmail)
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
      if (url.includes('/api/auth/callback')) {
        return `${baseUrl}/auth/oauth-callback`
      }
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      try {
        if (new URL(url).origin === baseUrl) {
          return url
        }
      } catch {
        // Invalid URL
      }
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
      console.error('[NextAuth] ERROR:', code, JSON.stringify(metadata, null, 2))
    },
    warn(code) {
      console.warn('[NextAuth] WARN:', code)
    },
    debug(code, metadata) {
      console.log('[NextAuth] DEBUG:', code, metadata)
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

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
