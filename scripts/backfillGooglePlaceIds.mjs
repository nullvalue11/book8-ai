#!/usr/bin/env node
/**
 * Book8-AI — One-time backfill: googlePlaceId via Google Places Text Search API
 *
 * For each business missing a usable place id, builds a query from name + address
 * fields on the document, calls Text Search, and sets googlePlaceId.
 *
 * Uses the same env as the app (MONGO_URL, DB_NAME) and BOO-81B reviews
 * (GOOGLE_MAPS_API_KEY).
 *
 * Initial documented targets:
 *   - biz_mnmmr26lnj5ug5 (Diamond Car Wash, 4806 Bank Street, Ottawa)
 *   - biz_mnmqsh4xnfygae (Diamond Car Wash Rideau, 5 Daly Avenue, Ottawa)
 *
 * USAGE:
 *   # Preview all businesses missing googlePlaceId / nested placeId
 *   MONGO_URL="..." GOOGLE_MAPS_API_KEY="..." node scripts/backfillGooglePlaceIds.mjs --dry-run
 *
 *   # Only the two Diamond Car Wash locations
 *   MONGO_URL="..." GOOGLE_MAPS_API_KEY="..." node scripts/backfillGooglePlaceIds.mjs --only=biz_mnmmr26lnj5ug5,biz_mnmqsh4xnfygae
 *
 *   MONGODB_URI is accepted as an alias for MONGO_URL (see purge scripts).
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

/**
 * Matches app + reviews resolver: treat as present if top-level or nested placeId exists.
 */
function hasUsablePlaceId(doc) {
  const top = doc.googlePlaceId
  if (typeof top === 'string' && top.trim()) return true
  const nested = doc.googlePlaces?.placeId
  if (typeof nested === 'string' && nested.trim()) return true
  return false
}

/**
 * Build a single line for Places Text Search from business name + profile + city.
 */
function buildSearchQuery(b) {
  const parts = []
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (name) parts.push(name)

  const bp = b.businessProfile && typeof b.businessProfile === 'object' ? b.businessProfile : {}

  const street = typeof bp.street === 'string' ? bp.street.trim() : ''
  const street2 = typeof bp.street2 === 'string' ? bp.street2.trim() : ''
  const addrLine = [street, street2].filter(Boolean).join(', ')
  if (addrLine) parts.push(addrLine)

  const cityTop = typeof b.city === 'string' ? b.city.trim() : ''
  const cityBp = typeof bp.city === 'string' ? bp.city.trim() : ''
  const city = cityTop || cityBp
  const prov = typeof bp.provinceState === 'string' ? bp.provinceState.trim() : ''
  const postal = typeof bp.postalCode === 'string' ? bp.postalCode.trim() : ''
  const country = typeof bp.country === 'string' ? bp.country.trim() : ''

  const tail = [city, prov, postal, country].filter(Boolean).join(' ')
  if (tail) parts.push(tail)

  if (parts.length <= 1 && b.googlePlaces && typeof b.googlePlaces === 'object') {
    const fa = b.googlePlaces.formattedAddress
    if (typeof fa === 'string' && fa.trim()) parts.push(fa.trim())
  }

  return parts.join(', ').trim()
}

function resolveDbName(uri) {
  const trimmed = String(uri || '').trim()
  const match = trimmed.match(/\/([^/?]+)(\?|$)/)
  if (match && match[1] && !['', 'mongodb.net'].includes(match[1])) {
    return match[1]
  }
  return process.env.DB_NAME || 'book8'
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  let onlyIds = null
  for (const a of argv) {
    if (a.startsWith('--only=')) {
      onlyIds = a
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return { dryRun, onlyIds }
}

/**
 * @param {string} query
 * @param {string} apiKey
 * @returns {Promise<string | null>} place_id or null
 */
async function textSearchFirstPlaceId(query, apiKey) {
  const u = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  u.searchParams.set('query', query)
  u.searchParams.set('key', apiKey)

  const res = await fetch(u.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))

  if (data.status === 'ZERO_RESULTS') return null
  if (data.status !== 'OK') {
    const msg = data.error_message ? `${data.status}: ${data.error_message}` : data.status || 'unknown'
    throw new Error(msg)
  }

  const first = Array.isArray(data.results) ? data.results[0] : null
  const pid = first && typeof first.place_id === 'string' ? first.place_id.trim() : null
  return pid || null
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { dryRun, onlyIds } = parseArgs(process.argv.slice(2))
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URL || '').trim()
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim()

  if (!uri) {
    console.error('ERROR: Set MONGO_URL (or MONGODB_URI)')
    process.exit(1)
  }
  if (!apiKey) {
    console.error('ERROR: Set GOOGLE_MAPS_API_KEY (same as BOO-81B reviews endpoint)')
    process.exit(1)
  }

  const dbName = resolveDbName(uri)
  console.log(`Database: ${dbName}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  if (onlyIds?.length) console.log(`Filter: --only ${onlyIds.join(', ')}`)
  console.log('---')

  const client = new MongoClient(uri)
  await client.connect()
  const coll = client.db(dbName).collection(COLLECTION)

  const mongoFilter = onlyIds?.length ? { businessId: { $in: onlyIds } } : {}
  const candidates = await coll.find(mongoFilter).toArray()
  const targets = candidates.filter((b) => !hasUsablePlaceId(b))

  console.log(`Candidates from Mongo: ${candidates.length}`)
  console.log(`Missing googlePlaceId (and nested placeId): ${targets.length}`)
  console.log('---')

  let updated = 0
  let skippedNoQuery = 0
  let skippedNoResult = 0
  let errors = 0

  for (const b of targets) {
    const businessId = b.businessId || b.id
    const query = buildSearchQuery(b)
    if (!query) {
      console.log(`[skip] ${businessId} — empty search query (no name/address)`)
      skippedNoQuery++
      continue
    }

    let placeId = null
    try {
      placeId = await textSearchFirstPlaceId(query, apiKey)
    } catch (e) {
      console.error(`[error] ${businessId} query="${query}" → ${e.message || e}`)
      errors++
      await sleep(250)
      continue
    }

    if (!placeId) {
      console.log(`[no-result] ${businessId} query="${query}"`)
      skippedNoResult++
      await sleep(250)
      continue
    }

    console.log(`[${dryRun ? 'would-update' : 'update'}] ${businessId} query="${query}" place_id=${placeId}`)

    if (!dryRun) {
      await coll.updateOne(
        { businessId },
        { $set: { googlePlaceId: placeId, updatedAt: new Date() } }
      )
      updated++
    } else {
      updated++
    }

    await sleep(250)
  }

  console.log('---')
  console.log('Summary')
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${updated}`)
  console.log(`  No query (empty): ${skippedNoQuery}`)
  console.log(`  No Text Search result: ${skippedNoResult}`)
  console.log(`  Errors: ${errors}`)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
