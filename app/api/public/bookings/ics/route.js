import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { buildICS } from '@/lib/ics'
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
    const bookingId = url.searchParams.get('bookingId')
    const email = url.searchParams.get('email')

    if (!bookingId || !email) {
      return NextResponse.json(
        { ok: false, error: 'Missing bookingId or email' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Find booking and verify email matches
    const booking = await database.collection('bookings').findOne({ 
      id: bookingId,
      guestEmail: email
    })

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found or email does not match' },
        { status: 404 }
      )
    }

    // Get owner info for organizer email
    const owner = await database.collection('users').findOne({ id: booking.userId })
    const organizerEmail = owner?.email || 'noreply@book8.ai'
    const organizerName = owner?.scheduling?.handle || 'Book8 AI'

    // Generate ICS file
    const icsContent = buildICS({
      uid: `booking-${bookingId}@book8.ai`,
      start: booking.startTime,
      end: booking.endTime,
      summary: booking.title,
      description: `${booking.notes || ''}\n\n---\nSource: Book8 AI\nBooking ID: ${bookingId}`,
      organizer: organizerEmail,
      organizerName: organizerName,
      attendees: [
        { email: booking.guestEmail, name: booking.customerName || booking.guestEmail }
      ],
      method: 'REQUEST',
      location: booking.location || ''
    })

    // Return as downloadable file
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="booking-${bookingId}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('[ics] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
