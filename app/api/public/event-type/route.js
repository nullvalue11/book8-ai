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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

// GET - Get public event type info
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = url.searchParams.get('handle')
    const slug = url.searchParams.get('slug')
    
    if (!handle || !slug) {
      return NextResponse.json(
        { ok: false, error: 'handle and slug parameters required' },
        { status: 400 }
      )
    }
    
    const database = await connect()
    
    // Find user by handle
    const owner = await database.collection('users').findOne({
      'scheduling.handleLower': handle.toLowerCase()
    })
    
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Find event type
    const eventType = await database.collection('event_types').findOne({
      userId: owner.id,
      slug: slug.toLowerCase(),
      isActive: true
    })
    
    if (!eventType) {
      return NextResponse.json(
        { ok: false, error: 'Event type not found or inactive' },
        { status: 404 }
      )
    }
    
    // Return public info only
    return NextResponse.json({
      ok: true,
      eventType: {
        name: eventType.name,
        description: eventType.description,
        slug: eventType.slug,
        durationMinutes: eventType.durationMinutes
      },
      ownerName: owner.name || owner.email?.split('@')[0] || handle
    })
    
  } catch (error) {
    console.error('[public/event-type] GET error:', error)
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
