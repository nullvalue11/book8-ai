#!/usr/bin/env node
/**
 * Book8 — ONE-OFF / MANUAL: backfill subscription.currentPeriodStart / currentPeriodEnd
 * on business documents after BOO-CANCEL-1C-FIX-2 deploy (Basil API: periods on items).
 *
 * NOT part of the repo release — do not commit this file if you prefer it local-only.
 *
 * Prerequisites: same Stripe + Mongo env as production (STRIPE_SECRET_KEY, MONGO_URL, DB_NAME).
 * Optional: STRIPE_PRICE_CALL_MINUTE_METERED (same as app) to pick the base line item.
 *
 * USAGE:
 *   node scripts/backfill-subscription-periods-v4.mjs --dry-run
 *   node scripts/backfill-subscription-periods-v4.mjs
 *
 *   # Limit to specific business ids (comma-separated)
 *   node scripts/backfill-subscription-periods-v4.mjs --only=biz_abc,biz_def
 */

/* eslint-disable no-console */

import { MongoClient } from 'mongodb'

try {
  const { config } = await import('dotenv')
  config()
} catch {
  /* dotenv optional */
}

const COLLECTION = 'businesses'

function getPeriodUnix(sub, meteredPriceId) {
  if (!sub || typeof sub !== 'object') return { start: null, end: null }
  let start = sub.current_period_start ?? null
  let end = sub.current_period_end ?? null
  const metered = meteredPriceId || ''
  if (start == null || end == null) {
    const baseItem = (sub.items?.data || []).find(
      (i) => i.price?.id && i.price.id !== metered
    )
    start = baseItem?.current_period_start ?? start
    end = baseItem?.current_period_end ?? end
  }
  return { start: start ?? null, end: end ?? null }
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  let only = null
  const onlyArg = argv.find((a) => a.startsWith('--only='))
  if (onlyArg) {
    only = onlyArg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return { dryRun, only }
}

const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI
const dbName = process.env.DB_NAME || 'book8'
const stripeSecret = process.env.STRIPE_SECRET_KEY
const meteredPriceId = process.env.STRIPE_PRICE_CALL_MINUTE_METERED || ''

const { dryRun, only } = parseArgs(process.argv.slice(2))

if (!mongoUrl) {
  console.error('Missing MONGO_URL (or MONGODB_URI)')
  process.exit(1)
}
if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY')
  process.exit(1)
}

const Stripe = (await import('stripe')).default
const stripe = new Stripe(stripeSecret)

const client = new MongoClient(mongoUrl)
await client.connect()
const db = client.db(dbName)
const col = db.collection(COLLECTION)

const query = {
  'subscription.stripeSubscriptionId': { $exists: true, $nin: [null, ''] },
  $or: [
    { 'subscription.currentPeriodStart': { $in: [null, ''] } },
    { 'subscription.currentPeriodStart': { $exists: false } },
    { 'subscription.currentPeriodEnd': { $in: [null, ''] } },
    { 'subscription.currentPeriodEnd': { $exists: false } }
  ]
}
if (only?.length) {
  query.$and = [{ $or: [{ businessId: { $in: only } }, { id: { $in: only } }] }]
}

const cursor = col.find(query)
let scanned = 0
let updated = 0
let skipped = 0
let failed = 0

for await (const doc of cursor) {
  scanned += 1
  const bid = doc.businessId || doc.id
  const subId = doc.subscription?.stripeSubscriptionId
  if (!subId) {
    skipped += 1
    continue
  }
  try {
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
    const { start, end } = getPeriodUnix(sub, meteredPriceId)
    if (start == null || end == null) {
      console.warn(`[skip] ${bid} sub=${subId}: could not resolve period from Stripe`)
      skipped += 1
      continue
    }
    const currentPeriodStart = new Date(start * 1000).toISOString()
    const currentPeriodEnd = new Date(end * 1000).toISOString()
    if (dryRun) {
      console.log(`[dry-run] ${bid} -> start=${currentPeriodStart} end=${currentPeriodEnd}`)
      updated += 1
      continue
    }
    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          'subscription.currentPeriodStart': currentPeriodStart,
          'subscription.currentPeriodEnd': currentPeriodEnd,
          updatedAt: new Date()
        }
      }
    )
    console.log(`[ok] ${bid} -> start=${currentPeriodStart} end=${currentPeriodEnd}`)
    updated += 1
  } catch (e) {
    failed += 1
    console.error(`[fail] ${bid} sub=${subId}:`, e?.message || e)
  }
}

await client.close()
console.log(
  JSON.stringify({ dryRun, scanned, updated, skipped, failed }, null, 2)
)
