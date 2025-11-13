import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyCancelToken } from '@/lib/security/resetToken'
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

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing token' },
        { status: 400 }
      )
    }

    // Verify token format and extract bookingId
    const verification = verifyCancelToken(token)
    
    if (!verification.valid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Find booking by token
    const booking = await database.collection('bookings').findOne({ 
      cancelToken: token,
      status: { $ne: 'canceled' }
    })

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found or already canceled' },
        { status: 404 }
      )
    }

    // Return booking details for confirmation
    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        title: booking.title,
        customerName: booking.customerName,
        guestEmail: booking.guestEmail,
        startTime: booking.startTime,
        endTime: booking.endTime,
        timeZone: booking.timeZone,
        guestTimezone: booking.guestTimezone,
        notes: booking.notes,
        status: booking.status
      }
    })

  } catch (error) {
    console.error('[cancel/verify] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
