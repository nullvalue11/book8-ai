import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { buildGoogleEventFromBooking } from '../../../../lib/googleSync'
import { getDueReminders, markReminderSent } from '../../../../lib/reminders'
import { renderReminder24h, renderReminder1h, getReminderSubject } from '../../../../lib/emailRenderer'
import { env, isFeatureEnabled } from '@/app/lib/env'

export const runtime = 'nodejs'

let client
let db
let indexes = false

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  if (!indexes) {
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true })
      await db.collection('bookings').createIndex({ userId: 1, startTime: 1 })
      await db.collection('google_events').createIndex({ userId: 1, bookingId: 1 }, { unique: true })
      await db.collection('cron_logs').createIndex({ startedAt: -1 })
    } catch {}
    indexes = true
  }
  return db
}

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*' || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  resp.headers.set('Access-Control-Allow-Credentials', 'true')
  return resp
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function json(data, init = {}) { return cors(NextResponse.json(data, init)) }

async function getOAuth2Client() {
  const clientId = env.GOOGLE?.CLIENT_ID
  const clientSecret = env.GOOGLE?.CLIENT_SECRET
  const redirectUri = env.GOOGLE?.REDIRECT_URI
  try {
    const { google } = await import('googleapis')
    if (!clientId || !clientSecret) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) {
    console.error('[Cron] Failed to load googleapis dynamically', e?.message || e)
    return null
  }
}

async function getGoogleClientForUser(userId) {
  const db = await connectToMongo()
  const user = await db.collection('users').findOne({ id: userId })
  const refreshToken = user?.google?.refreshToken
  if (!refreshToken) return null
  const o = await getOAuth2Client()
  if (!o) return null
  o.setCredentials({ refresh_token: refreshToken })
  try {
    const { google } = await import('googleapis')
    return google.calendar({ version: 'v3', auth: o })
  } catch (e) {
    console.error('[Cron] Failed to load calendar client dynamically', e?.message || e)
    return null
  }
}

export async function GET(request) {
  try {
    const db = await connectToMongo()
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')
    const task = url.searchParams.get('task') || 'sync'
    const cronHeader = request.headers.get('x-vercel-cron')

    if (!secret && !cronHeader) return json({ error: 'Unauthorized' }, { status: 401 })
    if (secret && env.CRON_SECRET && secret !== env.CRON_SECRET) return json({ error: 'Unauthorized' }, { status: 401 })

    const logsEnabled = String(env.DEBUG_LOGS || '').toLowerCase() === 'true'
    const runId = uuidv4()
    
    // Route to specific task
    if (task === 'reminders') {
      return await handleRemindersTask(db, runId, logsEnabled)
    }
    
    // Default: Google Calendar sync task
    return await handleGoogleSyncTask(db, runId, logsEnabled, cronHeader)
    
  } catch (e) {
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleGoogleSyncTask(db, runId, logsEnabled, cronHeader) {
  if (logsEnabled) await db.collection('cron_logs').insertOne({ task: 'google_sync', runId, startedAt: new Date(), triggeredBy: cronHeader ? 'vercel' : 'external' })

  const users = await db.collection('users').find({ 'google.refreshToken': { $exists: true, $ne: null } }).limit(50).toArray()
  let processed = 0
  for (const u of users) {
    try {
      const calendar = await getGoogleClientForUser(u.id)
      if (!calendar) continue
      const all = await db.collection('bookings').find({ userId: u.id }).toArray()
      const active = all.filter(b => b.status !== 'canceled')
      const canceled = all.filter(b => b.status === 'canceled')
      // upsert active
      for (const b of active) {
        const map = await db.collection('google_events').findOne({ userId: u.id, bookingId: b.id })
        const evt = buildGoogleEventFromBooking(b)
        if (!map?.googleEventId) {
          const ins = await calendar.events.insert({ calendarId: map?.calendarId || 'primary', requestBody: evt })
          await db.collection('google_events').updateOne(
            { userId: u.id, bookingId: b.id },
            { $set: { userId: u.id, bookingId: b.id, googleEventId: ins.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } },
            { upsert: true }
          )
        } else {
          await calendar.events.patch({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId, requestBody: evt })
          await db.collection('google_events').updateOne({ userId: u.id, bookingId: b.id }, { $set: { updatedAt: new Date() } })
        }
      }
      // delete canceled
      for (const b of canceled) {
        const map = await db.collection('google_events').findOne({ userId: u.id, bookingId: b.id })
        if (map?.googleEventId) {
          try { await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId }) } catch {}
          await db.collection('google_events').deleteOne({ userId: u.id, bookingId: b.id })
        }
      }
      await db.collection('users').updateOne({ id: u.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
      processed++
    } catch {}
  }

  if (logsEnabled) await db.collection('cron_logs').updateOne({ runId }, { $set: { finishedAt: new Date(), processed } })

  return json({ ok: true, task: 'google_sync', processed })
}

async function handleRemindersTask(db, runId, logsEnabled) {
  // Check if reminders feature is enabled
  if (!isFeatureEnabled('REMINDERS')) {
    return json({ ok: false, error: 'Reminders feature not enabled' }, { status: 503 })
  }
  
  if (logsEnabled) {
    await db.collection('cron_logs').insertOne({ 
      task: 'reminders', 
      runId, 
      startedAt: new Date() 
    })
  }
  
  const now = new Date()
  let processed = 0
  let successes = 0
  let failures = 0
  const errors = []
  
  try {
    // Find bookings with due reminders
    const bookings = await db.collection('bookings').find({
      status: 'confirmed',
      reminders: {
        $elemMatch: {
          sentAtUtc: null,
          sendAtUtc: { $lte: now.toISOString() }
        }
      }
    }).toArray()
    
    console.log(`[cron:reminders] Found ${bookings.length} bookings with due reminders`)
    
    // Process each booking
    for (const booking of bookings) {
      const dueReminders = getDueReminders(booking)
      
      for (const reminder of dueReminders) {
        processed++
        
        try {
          // Get owner
          const owner = await db.collection('users').findOne({ id: booking.userId })
          if (!owner) {
            console.error(`[cron:reminders] Owner not found for booking ${booking.id}`)
            failures++
            errors.push({ bookingId: booking.id, reminderId: reminder.id, error: 'Owner not found' })
            continue
          }
          
          // Render email based on reminder type
          const emailHtml = reminder.type === '24h'
            ? await renderReminder24h(booking, owner, booking.guestTimezone)
            : await renderReminder1h(booking, owner, booking.guestTimezone)
          
          const subject = getReminderSubject(reminder.type, booking.title)
          
          // Send via Resend with idempotency
          if (env.RESEND_API_KEY) {
            const { Resend } = await import('resend')
            const resend = new Resend(env.RESEND_API_KEY)
            
            const idempotencyKey = `reminders/${booking.id}/${reminder.id}`
            
            await resend.emails.send({
              from: 'Book8 AI <reminders@book8.ai>',
              to: booking.guestEmail,
              subject,
              html: emailHtml,
              headers: {
                'X-Idempotency-Key': idempotencyKey
              }
            })
            
            // Mark as sent in database
            const updatedReminders = markReminderSent(booking.reminders, reminder.id)
            await db.collection('bookings').updateOne(
              { id: booking.id },
              { $set: { reminders: updatedReminders } }
            )
            
            successes++
            console.log(`[cron:reminders] Sent ${reminder.type} reminder for booking ${booking.id}`)
          }
          
        } catch (error) {
          failures++
          console.error(`[cron:reminders] Failed to send reminder ${reminder.id}:`, error.message)
          errors.push({ 
            bookingId: booking.id, 
            reminderId: reminder.id, 
            error: error.message 
          })
        }
      }
    }
    
    // Write cron log
    if (logsEnabled) {
      await db.collection('cron_logs').updateOne(
        { runId },
        { 
          $set: { 
            finishedAt: new Date(), 
            processed, 
            successes, 
            failures,
            errors: errors.slice(0, 10) // Store first 10 errors only
          } 
        }
      )
    }
    
    return json({ 
      ok: true, 
      task: 'reminders',
      runId,
      processed, 
      successes, 
      failures 
    })
    
  } catch (error) {
    console.error('[cron:reminders] Task error:', error)
    
    if (logsEnabled) {
      await db.collection('cron_logs').updateOne(
        { runId },
        { 
          $set: { 
            finishedAt: new Date(), 
            processed,
            successes,
            failures,
            error: error.message 
          } 
        }
      )
    }
    
    return json({ 
      ok: false, 
      error: error.message,
      processed,
      successes,
      failures
    }, { status: 500 })
  }
}