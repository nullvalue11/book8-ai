import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyRescheduleToken } from '@/lib/security/rescheduleToken'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { resolveHostUserForBooking } from '@/lib/bookingCalendarGcal'

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

    // Verify token format
    const verification = verifyRescheduleToken(token)
    
    if (!verification.valid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Find booking by token
    const booking = await database.collection('bookings').findOne({ 
      rescheduleToken: token,
      status: 'confirmed' // Only allow rescheduling confirmed bookings
    })

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found or cannot be rescheduled' },
        { status: 404 }
      )
    }

    const { user: owner, business: hostBusiness } = await resolveHostUserForBooking(database, booking)
    let handle = owner?.scheduling?.handle || null
    if (!handle && hostBusiness) {
      handle = hostBusiness.handle || hostBusiness.businessId || null
    }
    if (!handle && owner?.id) {
      const business = await database.collection(BUSINESS_COLLECTION).findOne(
        { ownerUserId: owner.id },
        { sort: { createdAt: 1 } }
      )
      handle = business?.handle || business?.businessId || null
    }

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'Booking page not available' },
        { status: 404 }
      )
    }

    // Return booking details and handle
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
      },
      handle
    })

  } catch (error) {
    console.error('[reschedule/verify] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
