import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// MongoDB connection
let client
let db

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

const authOptions = {
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: env.GOOGLE?.CLIENT_ID || '',
      clientSecret: env.GOOGLE?.CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),
    // Microsoft OAuth (placeholder - will work when credentials are added)
    AzureADProvider({
      clientId: env.AZURE_AD?.CLIENT_ID || 'placeholder',
      clientSecret: env.AZURE_AD?.CLIENT_SECRET || 'placeholder',
      tenantId: env.AZURE_AD?.TENANT_ID || 'common',
    }),
    // Email/Password credentials (existing system)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const database = await connectToMongo()
          const user = await database.collection('users').findOne({ 
            email: String(credentials.email).toLowerCase() 
          })

          if (!user || !user.passwordHash) {
            return null
          }

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!isValid) {
            return null
          }

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
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[NextAuth] signIn callback:', { 
        provider: account?.provider, 
        email: user?.email,
        name: profile?.name 
      })

      // For OAuth providers, create or link user in our database
      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        try {
          const database = await connectToMongo()
          const email = user.email?.toLowerCase()
          
          if (!email) {
            console.error('[NextAuth] No email from OAuth provider')
            return false
          }

          // Check if user already exists
          let existingUser = await database.collection('users').findOne({ email })

          if (existingUser) {
            // Update OAuth provider info
            const updateField = account.provider === 'google' 
              ? { 'oauthProviders.google': { id: user.id, connectedAt: new Date() } }
              : { 'oauthProviders.microsoft': { id: user.id, connectedAt: new Date() } }
            
            await database.collection('users').updateOne(
              { email },
              { 
                $set: {
                  ...updateField,
                  lastLogin: new Date(),
                  name: existingUser.name || user.name || profile?.name || ''
                }
              }
            )
            console.log('[NextAuth] Linked OAuth to existing user:', email)
          } else {
            // Create new user
            const newUser = {
              id: uuidv4(),
              email,
              name: user.name || profile?.name || '',
              passwordHash: null, // OAuth users don't have password
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
            console.log('[NextAuth] Created new OAuth user:', email)
          }

          return true
        } catch (error) {
          console.error('[NextAuth] signIn error:', error)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.provider = account.provider
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        
        // For OAuth users, fetch the MongoDB user ID
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
      // After OAuth callback, redirect to a special handler page
      if (url.includes('/api/auth/callback')) {
        return `${baseUrl}/auth/oauth-callback`
      }
      // Allow relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // Allow same origin URLs
      if (new URL(url).origin === baseUrl) {
        return url
      }
      return baseUrl
    }
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: env.NEXTAUTH_SECRET || env.JWT_SECRET,
  debug: env.IS_DEVELOPMENT,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
