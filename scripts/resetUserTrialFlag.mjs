#!/usr/bin/env node
/**
 * BOO-TRIAL-ABUSE-1B — Clear trialEverUsed on a user (customer-success / admin override).
 *
 * Loads `.env` / `.env.local` like other repo scripts (see createBook8DemoBusiness.mjs).
 * Uses MONGO_URL or MONGODB_URI and DB_NAME (default: book8).
 *
 *   node scripts/resetUserTrialFlag.mjs user@example.com           # dry run
 *   node scripts/resetUserTrialFlag.mjs user@example.com --yes    # apply
 */

/* eslint-disable no-console */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFiles() {
  const root = path.join(__dirname, '..')
  /** @type {Record<string, string>} */
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
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      merged[key] = val
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    process.env[key] = val
  }
}

loadEnvFiles()

try {
  const { config } = await import('dotenv')
  config()
} catch {
  /* dotenv optional */
}

const emailArg = process.argv[2]
const confirm = process.argv.includes('--yes')

if (!emailArg || emailArg.startsWith('-')) {
  console.error('Usage: node scripts/resetUserTrialFlag.mjs <userEmail> [--yes]')
  process.exit(1)
}

const email = String(emailArg).trim().toLowerCase()
const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI
if (!mongoUrl) {
  console.error('Missing MONGO_URL (or MONGODB_URI) in environment or .env')
  process.exit(1)
}

const dbName = process.env.DB_NAME || 'book8'

const client = new MongoClient(mongoUrl)
await client.connect()
const db = client.db(dbName)

const user = await db.collection('users').findOne({ email })
if (!user) {
  console.error(`No user found for email: ${emailArg}`)
  await client.close()
  process.exit(1)
}

console.log('User:', {
  id: user.id,
  email: user.email,
  trialEverUsed: user.trialEverUsed,
  trialUsedAt: user.trialUsedAt
})

if (!confirm) {
  console.log('\nDRY RUN — no changes made. Add --yes to execute.')
  await client.close()
  process.exit(0)
}

const result = await db.collection('users').updateOne(
  { id: user.id },
  {
    $set: { trialEverUsed: false, trialUsedAt: null },
    $push: {
      trialResets: {
        resetAt: new Date(),
        previousTrialUsedAt: user.trialUsedAt ?? null,
        resetBy: 'admin-script'
      }
    }
  }
)

console.log('Reset:', result.modifiedCount === 1 ? 'OK' : 'FAILED')
await client.close()
