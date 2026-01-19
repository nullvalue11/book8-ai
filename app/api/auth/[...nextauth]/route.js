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

// Direct env access for NextAuth
const getEnv = (key, fallback = '') => process.env[key] || fallback

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

const authOptions = {
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: getEnv('GOOGLE_CLIENT_ID'),
      clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),
    // Microsoft OAuth
    AzureADProvider({
      clientId: getEnv('AZURE_AD_CLIENT_ID'),
      clientSecret: getEnv('AZURE_AD_CLIENT_SECRET'),
      tenantId: getEnv('AZURE_AD_TENANT_ID', 'common'),
    }),
    // Email/Password credentials
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
        email: user?.email 
      })

      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        try {
          const database = await connectToMongo()
          const email = user.email?.toLowerCase()
          
          if (!email) {
            console.error('[NextAuth] No email from OAuth provider')
            return false
          }

          let existingUser = await database.collection('users').findOne({ email })

          if (existingUser) {
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
          } else {
            const newUser = {
              id: uuidv4(),
              email,
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
          return true
        } catch (error) {
          console.error('[NextAuth] signIn error:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account && user) {
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
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: getEnv('NEXTAUTH_SECRET') || getEnv('JWT_SECRET'),
  debug: getEnv('NODE_ENV') === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
