import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function POST(req) {
  try {
    const { email, name, provider } = await req.json()
    
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })
    }

    const database = await connectToMongo()
    const normalizedEmail = email.toLowerCase()
    
    // Find or create user
    let user = await database.collection('users').findOne({ email: normalizedEmail })
    
    if (!user) {
      // Create new user from OAuth
      user = {
        id: uuidv4(),
        email: normalizedEmail,
        name: name || '',
        passwordHash: null,
        createdAt: new Date(),
        lastLogin: new Date(),
        subscription: null,
        google: provider === 'google' ? { connected: false, refreshToken: null } : null,
        oauthProviders: {
          [provider]: { connectedAt: new Date() }
        }
      }
      await database.collection('users').insertOne(user)
      console.log('[oauth-sync] Created new user:', normalizedEmail)
    } else {
      // Update last login
      await database.collection('users').updateOne(
        { email: normalizedEmail },
        { 
          $set: { 
            lastLogin: new Date(),
            [`oauthProviders.${provider}`]: { connectedAt: new Date() }
          }
        }
      )
      console.log('[oauth-sync] Updated existing user:', normalizedEmail)
    }

    // Generate our custom JWT token (same format as regular login)
    if (!env.JWT_SECRET) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return same format as regular login
    const googleSafe = user.google 
      ? { connected: !!user.google?.refreshToken, lastSyncedAt: user.google?.lastSyncedAt || null } 
      : { connected: false, lastSyncedAt: null }

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        subscription: user.subscription || null,
        google: googleSafe
      }
    })
  } catch (err) {
    console.error('[oauth-sync] Error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
