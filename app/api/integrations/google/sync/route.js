import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'

let client
let db

async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL is missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME is missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization')
  resp.headers.set('Access-Control-Allow-Credentials', 'true')
  return resp
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

const json = (data, init = {}) => cors(NextResponse.json(data, init))

function getJwtSecret() { return process.env.JWT_SECRET || 'dev-secret-change-me' }

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return json({ error: auth.error }, { status: auth.status })
    const u = await database.collection('users').findOne({ id: auth.user.id })
    const connected = !!(u?.google?.refreshToken || u?.google?.connected)
    return json({ connected, lastSyncedAt: u?.google?.lastSyncedAt || null })
  } catch (error) {
    console.error('Google sync status error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return json({ error: auth.error }, { status: auth.status })
    
    // TODO: Implement actual sync logic here
    // For now, just return a mock response
    return json({ 
      created: 0, 
      updated: 0, 
      deleted: 0,
      message: 'Sync functionality not yet implemented' 
    })
  } catch (error) {
    console.error('Google sync error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}