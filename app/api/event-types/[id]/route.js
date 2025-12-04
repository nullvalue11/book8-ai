import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
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

// GET - Get single event type
export async function GET(request, { params }) {
  try {
    const payload = await verifyAuth(request)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const database = await connect()
    const eventType = await database.collection('event_types').findOne({
      id: params.id,
      userId: payload.sub
    })
    
    if (!eventType) {
      return NextResponse.json(
        { ok: false, error: 'Event type not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ ok: true, eventType })
  } catch (error) {
    console.error('[event-types] GET error:', error)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

// PUT - Update event type
export async function PUT(request, { params }) {
  try {
    const payload = await verifyAuth(request)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const database = await connect()
    const body = await request.json()
    const { name, description, durationMinutes, isActive, scheduling, slug: newSlug } = body
    
    // Find existing event type
    const existing = await database.collection('event_types').findOne({
      id: params.id,
      userId: payload.sub
    })
    
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Event type not found' },
        { status: 404 }
      )
    }
    
    // Build update object
    const updates = {
      updatedAt: new Date().toISOString()
    }
    
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Name cannot be empty' },
          { status: 400 }
        )
      }
      updates.name = name.trim()
    }
    
    if (description !== undefined) {
      updates.description = description.trim()
    }
    
    if (durationMinutes !== undefined) {
      updates.durationMinutes = parseInt(durationMinutes) || 30
    }
    
    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive)
    }
    
    if (scheduling !== undefined) {
      updates.scheduling = {
        bufferMin: scheduling?.bufferMin ?? null,
        minNoticeMin: scheduling?.minNoticeMin ?? null,
        workingHours: scheduling?.workingHours ?? null,
        reminders: scheduling?.reminders ?? null
      }
    }
    
    // Handle slug change
    if (newSlug !== undefined && newSlug !== existing.slug) {
      const cleanSlug = slugify(newSlug)
      if (!cleanSlug) {
        return NextResponse.json(
          { ok: false, error: 'Invalid slug' },
          { status: 400 }
        )
      }
      
      // Check uniqueness
      const slugExists = await database.collection('event_types').findOne({
        userId: payload.sub,
        slug: cleanSlug,
        id: { $ne: params.id }
      })
      
      if (slugExists) {
        return NextResponse.json(
          { ok: false, error: 'An event type with this slug already exists' },
          { status: 409 }
        )
      }
      
      updates.slug = cleanSlug
    }
    
    await database.collection('event_types').updateOne(
      { id: params.id, userId: payload.sub },
      { $set: updates }
    )
    
    const updated = await database.collection('event_types').findOne({ id: params.id })
    
    console.log('[event-types] Updated:', params.id)
    return NextResponse.json({ ok: true, eventType: updated })
    
  } catch (error) {
    console.error('[event-types] PUT error:', error)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Delete event type
export async function DELETE(request, { params }) {
  try {
    const payload = await verifyAuth(request)
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const database = await connect()
    
    const result = await database.collection('event_types').deleteOne({
      id: params.id,
      userId: payload.sub
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Event type not found' },
        { status: 404 }
      )
    }
    
    console.log('[event-types] Deleted:', params.id)
    return NextResponse.json({ ok: true })
    
  } catch (error) {
    console.error('[event-types] DELETE error:', error)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
