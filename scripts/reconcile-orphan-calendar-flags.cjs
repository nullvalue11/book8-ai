#!/usr/bin/env node
/**
 * BOO-112B — Reconcile businesses where the owner has Google OAuth on users.google
 * but business.calendar.connected was never set (OAuth without businessId in state).
 *
 *   node scripts/reconcile-orphan-calendar-flags.cjs           # dry-run (default)
 *   node scripts/reconcile-orphan-calendar-flags.cjs --apply   # write fixes
 *
 * Env: MONGO_URL or MONGODB_URI, optional DB_NAME (default book8).
 * URI: /book8-core → /book8 (same pattern as other ops scripts).
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

function loadEnvFiles() {
  const root = path.join(__dirname, '..')
  const merged = {}
  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(root, name)
    let text
    try {
      text = fs.readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      merged[key] = val
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    process.env[k] = v
  }
}

loadEnvFiles()

const apply = process.argv.includes('--apply')

const raw = process.env.MONGO_URL || process.env.MONGODB_URI
if (!raw) {
  console.error('Missing MONGO_URL or MONGODB_URI')
  process.exit(1)
}
const uri = raw.replace(/\/book8-core(\?|$)/, '/book8$1')
const dbName = process.env.DB_NAME || 'book8'

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const businesses = await db.collection('businesses').find({}).toArray()
  const orphans = []

  for (const b of businesses) {
    const ownerUserId = b.ownerUserId
    if (!ownerUserId) continue
    const user = await db.collection('users').findOne({ id: ownerUserId })
    const g = user?.google
    const cal = b.calendar || {}
    const userLinked = g?.connected === true && !!g?.refreshToken
    const businessFlag = cal.connected === true
    if (userLinked && !businessFlag) {
      orphans.push({ b, user })
    }
  }

  console.log(`Found ${orphans.length} business(es) with user Google linked but business.calendar.connected !== true`)
  for (const { b } of orphans) {
    console.log(' -', b.businessId || b.id, 'ownerUserId=', b.ownerUserId)
  }

  if (!apply) {
    console.log('Dry-run only. Pass --apply to update these businesses.')
    await client.close()
    return
  }

  let modified = 0
  const now = new Date()
  for (const { b } of orphans) {
    const cal = b.calendar || {}
    const res = await db.collection('businesses').updateOne(
      { _id: b._id },
      {
        $set: {
          calendar: {
            connected: true,
            connectedAt: now.toISOString(),
            provider: 'google',
            calendarId: cal.calendarId ?? null,
            lastSyncedAt: cal.lastSyncedAt ?? null
          },
          updatedAt: now
        }
      }
    )
    if (res.modifiedCount) modified++
  }
  console.log('Applied. modifiedCount:', modified)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
