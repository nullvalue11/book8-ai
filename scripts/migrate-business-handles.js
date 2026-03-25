/**
 * One-time migration: Set handles for existing businesses
 * Run manually in Atlas or via: node scripts/migrate-business-handles.js
 *
 * Updates:
 * - biz_mmwfgpg50jkiub → ottawa-dental-clinic
 * - biz_mmpsyemadcrxuc → downtown-barber-co
 * - biz_mmzusq281oq7pb → fitness-studio
 * - biz_mmzzgvsy6tkwtm → river-city-massage
 */

const UPDATES = [
  { businessId: 'biz_mmwfgpg50jkiub', handle: 'ottawa-dental-clinic' },
  { businessId: 'biz_mmpsyemadcrxuc', handle: 'downtown-barber-co' },
  { businessId: 'biz_mmzusq281oq7pb', handle: 'fitness-studio' },
  { businessId: 'biz_mmzzgvsy6tkwtm', handle: 'river-city-massage' },
]

async function migrate() {
  const { MongoClient } = require('mongodb')
  const url = process.env.MONGO_URL
  if (!url) {
    console.error('MONGO_URL required')
    process.exit(1)
  }
  const client = new MongoClient(url)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'book8')
  const col = db.collection('businesses')

  for (const { businessId, handle } of UPDATES) {
    const res = await col.updateOne(
      { businessId },
      { $set: { handle, updatedAt: new Date() } }
    )
    console.log(
      res.modifiedCount
        ? `✓ ${businessId} → handle: ${handle}`
        : `- ${businessId} (not found or unchanged)`
    )
  }
  await client.close()
  console.log('Migration complete')
}

migrate().catch((e) => {
  console.error(e)
  process.exit(1)
})
