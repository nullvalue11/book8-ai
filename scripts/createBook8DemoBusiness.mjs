#!/usr/bin/env node
/**
 * OPTION-D — Idempotent Mongo upsert for the public "Book8 Demo" business (book8-demo / biz_book8demo).
 *
 * Uses the same env as the app: MONGO_URL or MONGODB_URI, and DB_NAME (default: book8).
 *
 *   MONGO_URL="..." DB_NAME="book8" node scripts/createBook8DemoBusiness.mjs --dry-run
 *   MONGO_URL="..." DB_NAME="book8" node scripts/createBook8DemoBusiness.mjs
 */

/* eslint-disable no-console */

import { MongoClient } from 'mongodb'

try {
  const { config } = await import('dotenv')
  config()
} catch {
  /* dotenv optional */
}

const USER_ID = 'user_book8demo'
const BUSINESS_ID = 'biz_book8demo'
const HANDLE = 'book8-demo'
const USERS = 'users'
const BUSINESSES = 'businesses'

const REMINDERS = {
  enabled: true,
  guestEnabled: true,
  hostEnabled: false,
  types: { '24h': true, '1h': true }
}

const WORKING_HOURS = {
  mon: [{ start: '09:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '17:00' }],
  sat: [],
  sun: []
}

const WEEKLY_HOURS_DISPLAY = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: []
}

const LOCAL_SCHEDULE_WEEKLY = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: []
}

const SERVICES = [
  {
    serviceId: 'svc_book8demo_a',
    name: 'Demo Service A',
    durationMinutes: 30,
    price: 50,
    currency: 'CAD'
  },
  {
    serviceId: 'svc_book8demo_b',
    name: 'Demo Service B',
    durationMinutes: 60,
    price: 100,
    currency: 'CAD'
  },
  {
    serviceId: 'svc_book8demo_c',
    name: 'Demo Service C',
    durationMinutes: 45,
    price: 75,
    currency: 'CAD'
  }
]

function buildUserDoc(now) {
  return {
    id: USER_ID,
    email: 'book8-demo-placeholder@book8.io',
    name: 'Book8 Demo',
    scheduling: {
      handle: HANDLE,
      handleLower: HANDLE,
      timeZone: 'America/Toronto',
      workingHours: WORKING_HOURS,
      defaultDurationMin: 30,
      bufferMin: 0,
      minNoticeMin: 60,
      selectedCalendarIds: [],
      reminders: REMINDERS
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdByBook8DemoScript: true
  }
}

function buildBusinessDoc(now) {
  return {
    id: BUSINESS_ID,
    businessId: BUSINESS_ID,
    handle: HANDLE,
    name: 'Book8 Demo',
    category: 'Demo Business',
    city: 'Ottawa',
    address: 'Demo Address, Ottawa, ON',
    timezone: 'America/Toronto',
    hours: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: null,
      sunday: null
    },
    services: SERVICES,
    description:
      'This is a Book8 demo booking page. Book8 is a multilingual AI phone receptionist for service businesses — it answers calls 24/7, books appointments, and speaks 70+ languages.',
    phone: null,
    website: 'https://book8.io',
    isDemo: true,
    ownerUserId: USER_ID,
    ownerEmail: 'book8-demo-placeholder@book8.io',
    status: 'ready',
    statusReason: 'Book8 demo business for outreach',
    localSchedule: {
      timezone: 'America/Toronto',
      weeklyHours: LOCAL_SCHEDULE_WEEKLY
    },
    businessProfile: {
      description:
        'This is a Book8 demo booking page. Book8 is a multilingual AI phone receptionist for service businesses — it answers calls 24/7, books appointments, and speaks 70+ languages.',
      website: 'https://book8.io',
      street: 'Demo Address',
      city: 'Ottawa',
      provinceState: 'ON',
      postalCode: '',
      country: 'CA',
      weeklyHours: WEEKLY_HOURS_DISPLAY
    },
    subscription: {
      status: 'none',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null
    },
    calendar: {
      connected: false,
      provider: null,
      calendarId: null,
      lastSyncedAt: null
    },
    features: {
      voiceEnabled: false,
      billingEnabled: false,
      agentEnabled: false
    },
    waitlistEnabled: true,
    createdAt: now,
    updatedAt: now,
    createdByBook8DemoScript: true
  }
}

const dryRun = process.argv.includes('--dry-run')
const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI
const dbName = process.env.DB_NAME || 'book8'

if (!mongoUrl) {
  console.error('Missing MONGO_URL or MONGODB_URI')
  process.exit(1)
}

const userDoc = buildUserDoc(new Date())
const businessDoc = buildBusinessDoc(new Date())

function assertNoGoogleFields(obj, path = 'root') {
  const banned = ['googlePlaceId', 'googlePlaces', 'googleReviewsCache', 'twilioNumber']
  for (const k of banned) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new Error(`Unexpected field ${k} at ${path}`)
    }
  }
}

assertNoGoogleFields(businessDoc)

if (dryRun) {
  console.log('[createBook8DemoBusiness] DRY RUN — would upsert:')
  console.log(JSON.stringify({ dbName, users: USERS, businesses: BUSINESSES, userDoc, businessDoc }, null, 2))
  process.exit(0)
}

const client = new MongoClient(mongoUrl)
await client.connect()
const db = client.db(dbName)

try {
  const prevBiz = await db.collection(BUSINESSES).findOne({ businessId: BUSINESS_ID })
  const prevUser = await db.collection(USERS).findOne({ id: USER_ID })

  await db.collection(USERS).replaceOne({ id: USER_ID }, userDoc, { upsert: true })
  await db.collection(BUSINESSES).replaceOne({ businessId: BUSINESS_ID }, businessDoc, { upsert: true })

  console.log('[createBook8DemoBusiness] OK')
  console.log(`  dbName=${dbName}`)
  console.log(`  users collection=${USERS} user.id=${USER_ID} ${prevUser ? 'updated' : 'inserted'}`)
  console.log(
    `  businesses collection=${BUSINESSES} businessId=${BUSINESS_ID} handle=${HANDLE} ${prevBiz ? 'updated' : 'inserted'}`
  )
} finally {
  await client.close()
}
