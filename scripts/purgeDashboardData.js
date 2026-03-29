/**
 * Book8 AI — Dashboard Database Purge
 *
 * Removes all businesses, subscriptions, calendar connections,
 * and provisioning alerts EXCEPT Downtown Barber.
 *
 * Keeps:
 * - Downtown Barber (biz_mmpsyemadcrxuc)
 * - All user accounts (not deleted; only business-linked rows above are removed)
 *
 * USAGE:
 *   MONGO_URL="mongodb+srv://..." DB_NAME=book8 node scripts/purgeDashboardData.js --dry-run
 *   MONGO_URL="mongodb+srv://..." DB_NAME=book8 node scripts/purgeDashboardData.js
 *
 * The app uses MONGO_URL + DB_NAME (see app/lib/env.js). MONGODB_URI is accepted as an alias.
 * If the URI includes a path (e.g. .../book8), that database wins; otherwise DB_NAME defaults to book8.
 *
 * IMPORTANT: Point this at the dashboard MongoDB (Vercel book8-ai), not the core-api database.
 */

/* eslint-disable no-console */

const { MongoClient } = require('mongodb')

try {
  require('dotenv').config()
} catch {
  /* optional: install dotenv or export vars in the shell */
}

const KEEP_BUSINESS_ID = 'biz_mmpsyemadcrxuc' // Downtown Barber
/** Verify these are gone after run (e.g. stray test tenants from other accounts) */
const MUST_NOT_EXIST_AFTER_RUN = ['biz_mkgabnsmuzyjmw'] // Wais Mo Fitness
const dryRun = process.argv.includes('--dry-run')

function resolveDbName(uri) {
  const trimmed = String(uri || '').trim()
  const match = trimmed.match(/\/([^/?]+)(\?|$)/)
  if (match && match[1] && !['', 'mongodb.net'].includes(match[1])) {
    return match[1]
  }
  return process.env.DB_NAME || 'book8'
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL
  if (!uri) {
    console.error('ERROR: Set MONGO_URL or MONGODB_URI')
    process.exit(1)
  }

  const dbName = resolveDbName(uri)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  console.log(`Connected to database: ${dbName}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Keeping: ${KEEP_BUSINESS_ID} (Downtown Barber)`)
  console.log('---')

  const allBiz = await db.collection('businesses').find({}).toArray()
  const toDelete = allBiz.filter((b) => {
    const id = b.businessId || b.id
    return id !== KEEP_BUSINESS_ID
  })
  const toKeep = allBiz.filter((b) => {
    const id = b.businessId || b.id
    return id === KEEP_BUSINESS_ID
  })

  console.log(`\nTotal businesses in ${dbName}: ${allBiz.length}`)
  console.log(`Keeping: ${toKeep.length}`)
  toKeep.forEach((b) => console.log(`  ✓ ${b.name} [${b.businessId || b.id}]`))
  console.log(`Deleting: ${toDelete.length}`)
  toDelete.forEach((b) => console.log(`  ✗ ${b.name || 'unnamed'} [${b.businessId || b.id}]`))

  const purgeIds = []
  toDelete.forEach((b) => {
    if (b.businessId) purgeIds.push(b.businessId)
    if (b.id && b.id !== b.businessId) purgeIds.push(b.id)
  })
  const uniquePurgeIds = [...new Set(purgeIds)]

  const countByBusinessId = async (collectionName) => {
    try {
      return await db.collection(collectionName).countDocuments({
        businessId: { $in: uniquePurgeIds }
      })
    } catch (e) {
      console.warn(`  [warn] count ${collectionName}: ${e.message}`)
      return 0
    }
  }

  if (dryRun) {
    const subCount = await countByBusinessId('subscriptions')
    const calCount = await countByBusinessId('calendarConnections')
    const alertCount = await countByBusinessId('provisioningAlerts')

    console.log(`\nWould delete ${toDelete.length} businesses (purge id rows: ${uniquePurgeIds.length})`)
    console.log(`Would delete ${subCount} subscriptions (businessId in purge list)`)
    console.log(`Would delete ${calCount} calendar connections`)
    console.log(`Would delete ${alertCount} provisioning alerts`)
    console.log('\nNo user accounts will be deleted.')
  } else if (uniquePurgeIds.length > 0) {
    const subResult = await db.collection('subscriptions').deleteMany({
      businessId: { $in: uniquePurgeIds }
    })
    console.log(`\nDeleted ${subResult.deletedCount} subscriptions`)

    const calResult = await db.collection('calendarConnections').deleteMany({
      businessId: { $in: uniquePurgeIds }
    })
    console.log(`Deleted ${calResult.deletedCount} calendar connections`)

    const alertResult = await db.collection('provisioningAlerts').deleteMany({
      businessId: { $in: uniquePurgeIds }
    })
    console.log(`Deleted ${alertResult.deletedCount} provisioning alerts`)

    const bizResult = await db.collection('businesses').deleteMany({
      $or: [{ businessId: { $in: uniquePurgeIds } }, { id: { $in: uniquePurgeIds } }]
    })
    console.log(`Deleted ${bizResult.deletedCount} businesses`)

    console.log('\nUser accounts preserved (not deleted).')
  } else {
    console.log('\nNothing to delete (only the kept business present, or no purge ids).')
  }

  console.log('\n=== VERIFICATION ===\n')
  const remaining = await db.collection('businesses').find({}).toArray()
  console.log(`Businesses remaining: ${remaining.length}`)
  remaining.forEach((b) => {
    console.log(`  ${b.name || 'unnamed'} [${b.businessId || b.id}]`)
  })

  const users = await db.collection('users').countDocuments({})
  console.log(`User accounts (unchanged): ${users}`)

  const subs = await db.collection('subscriptions').find({}).toArray()
  console.log(`Subscriptions remaining: ${subs.length}`)
  subs.forEach((s) => {
    console.log(`  ${s.businessId} — ${s.plan || 'unknown'} — ${s.status}`)
  })

  console.log('\n=== MUST-NOT-EXIST CHECK (test / stray IDs) ===\n')
  for (const id of MUST_NOT_EXIST_AFTER_RUN) {
    const found = await db.collection('businesses').findOne({
      $or: [{ businessId: id }, { id }]
    })
    if (found) {
      console.error(`❌ STILL PRESENT: ${id} (${found.name || 'unnamed'}) — run live purge or delete manually`)
    } else {
      console.log(`✓ Absent (ok): ${id}`)
    }
  }

  await client.close()
  console.log('\nDone.')
}

run().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
