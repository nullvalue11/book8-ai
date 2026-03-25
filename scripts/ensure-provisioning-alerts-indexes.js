/**
 * One-time / CI: ensure provisioningAlerts indexes (TTL + lookup).
 * Run: MONGO_URL=... DB_NAME=book8 node scripts/ensure-provisioning-alerts-indexes.js
 */

const { MongoClient } = require('mongodb')

async function main() {
  const url = process.env.MONGO_URL
  const dbName = process.env.DB_NAME || 'book8'
  if (!url) {
    console.error('MONGO_URL missing')
    process.exit(1)
  }
  const client = new MongoClient(url)
  await client.connect()
  const db = client.db(dbName)
  await db
    .collection('provisioningAlerts')
    .createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
  await db.collection('provisioningAlerts').createIndex({ businessId: 1, resolved: 1 })
  console.log('provisioningAlerts indexes OK')
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
