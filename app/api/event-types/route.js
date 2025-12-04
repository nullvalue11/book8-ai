import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/lib/env'
import { DEFAULT_REMINDER_SETTINGS } from '@/lib/reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db, indexed = false

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  if (!indexed) {
    try {
      // Compound unique index on userId + slug
      await db.collection('event_types').createIndex(
        { userId: 1, slug: 1 }, 
        { unique: true }
      )
      await db.collection('event_types').createIndex({ userId: 1, isActive: 1 })
    } catch {}
    indexed = true
  }
  return db
}

async function verifyAuth(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  
  const jwt = (await import('jsonwebtoken')).default
  try {
    return jwt.verify(token, env.JWT_SECRET)
  } catch {
    return null
  }
}

// Slugify helper
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// GET - List user's event types
export async function GET(request) {
  try {
    const payload = await verifyAuth(request)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const database = await connect()
    const eventTypes = await database.collection('event_types')
      .find({ userId: payload.sub })
      .sort({ createdAt: -1 })
      .toArray()
    
    return NextResponse.json({ ok: true, eventTypes })
  } catch (error) {
    console.error('[event-types] GET error:', error)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

// POST - Create new event type
export async function POST(request) {
  try {
    const payload = await verifyAuth(request)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const database = await connect()
    const body = await request.json()
    const { name, description, durationMinutes, scheduling } = body
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Name is required' },
        { status: 400 }
      )
    }
    
    // Generate slug from name
    let baseSlug = slugify(name)
    if (!baseSlug) baseSlug = 'event'
    
    // Check for slug uniqueness and append number if needed
    let slug = baseSlug
    let counter = 1
    while (true) {
      const existing = await database.collection('event_types').findOne({
        userId: payload.sub,
        slug
      })
      if (!existing) break
      slug = `${baseSlug}-${counter}`
      counter++
    }
    
    const eventType = {
      id: uuidv4(),
      userId: payload.sub,
      slug,
      name: name.trim(),
      description: description?.trim() || '',
      durationMinutes: parseInt(durationMinutes) || 30,
      isActive: true,
      scheduling: {
        // Override fields (null means use user's default)
        bufferMin: scheduling?.bufferMin ?? null,
        minNoticeMin: scheduling?.minNoticeMin ?? null,
        workingHours: scheduling?.workingHours ?? null,
        reminders: scheduling?.reminders ?? null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await database.collection('event_types').insertOne(eventType)
    
    console.log('[event-types] Created:', eventType.id, eventType.slug)
    return NextResponse.json({ ok: true, eventType })
    
  } catch (error) {
    console.error('[event-types] POST error:', error)
    if (error.code === 11000) {
      return NextResponse.json(
        { ok: false, error: 'An event type with this slug already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
