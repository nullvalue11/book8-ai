import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyRescheduleToken } from '../../../lib/security/rescheduleToken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function isFeatureEnabled(featureName) {
  return process.env[featureName] === 'true'
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

export async function GET(request) {
  try {
    if (!isFeatureEnabled('FEATURE_RESCHEDULE')) {
      return NextResponse.json(
        { ok: false, error: 'Reschedule feature is not enabled' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify token
    const decoded = verifyRescheduleToken(token)
    if (!decoded) {
      return NextResponse.json(
        { ok: false, error: 'invalid' },
        { status: 410 }
      )
    }

    const database = await connect()
    
    // Find booking
    const booking = await database.collection('bookings').findOne({ 
      id: decoded.bookingId 
    })
    
    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Verify email matches
    if (booking.guestEmail !== decoded.guestEmail) {
      return NextResponse.json(
        { ok: false, error: 'mismatch' },
        { status: 403 }
      )
    }

    // Check if already canceled
    if (booking.status === 'canceled') {
      return NextResponse.json(
        { ok: false, error: 'This booking has been canceled' },
        { status: 410 }
      )
    }

    // Check if nonce was already used
    const nonce = booking.rescheduleNonces?.find(n => n.nonce === decoded.nonce)
    if (nonce && nonce.usedAt) {
      return NextResponse.json(
        { ok: false, error: 'used' },
        { status: 410 }
      )
    }

    // Get owner settings
    const owner = await database.collection('users').findOne({ id: booking.userId })
    if (!owner || !owner.scheduling) {
      return NextResponse.json(
        { ok: false, error: 'Owner not found' },
        { status: 404 }
      )
    }

    // Return minimal booking info + settings
    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        title: booking.title,
        currentStart: booking.startTime,
        currentEnd: booking.endTime,
        guestTimezone: booking.guestTimezone || booking.timeZone
      },
      settings: {
        timezone: owner.scheduling.timeZone || 'UTC',
        defaultDurationMin: owner.scheduling.defaultDurationMin || 30,
        minNoticeMin: owner.scheduling.minNoticeMin || 120,
        bufferMin: owner.scheduling.bufferMin || 0,
        handle: owner.scheduling.handle
      }
    })

  } catch (error) {
    console.error('[reschedule/verify] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
