/**
 * Shared MongoDB connection for server routes (native driver — no Mongoose).
 */

import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'

let client
let db
/** @type {Promise<void> | null} */
let connecting

export async function getMongoDb() {
  if (db) return db
  if (!connecting) {
    const url = env.MONGO_URL
    if (!url || typeof url !== 'string') {
      throw new Error('MONGO_URL is not configured')
    }
    connecting = (async () => {
      try {
        const c = new MongoClient(url)
        await c.connect()
        client = c
        db = c.db(env.DB_NAME)
      } catch (e) {
        connecting = null
        throw e
      }
    })()
  }
  await connecting
  return /** @type {import('mongodb').Db} */ (db)
}
