/**
 * GET /api/public/portfolio-media?pid=<uuid>
 * Streams a GridFS portfolio image (metadata.photoId must match).
 */

import { NextResponse } from 'next/server'
import { MongoClient, GridFSBucket } from 'mongodb'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const pid = url.searchParams.get('pid') || ''
    if (!pid || !UUID_RE.test(pid)) {
      return NextResponse.json({ ok: false, error: 'Invalid pid' }, { status: 400 })
    }

    const database = await connect()
    const filesColl = database.collection('portfolio_fs.files')
    const doc = await filesColl.findOne({ 'metadata.photoId': pid })
    if (!doc || !doc._id) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }

    const bucket = new GridFSBucket(database, { bucketName: 'portfolio_fs' })
    const chunks = []
    const downloadStream = bucket.openDownloadStream(doc._id)
    await new Promise((resolve, reject) => {
      downloadStream.on('data', (c) => chunks.push(c))
      downloadStream.on('end', resolve)
      downloadStream.on('error', reject)
    })

    const body = Buffer.concat(chunks)
    const ct = doc.metadata?.contentType || 'image/jpeg'
    return new NextResponse(body, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400'
      }
    })
  } catch (e) {
    console.error('[public/portfolio-media]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
