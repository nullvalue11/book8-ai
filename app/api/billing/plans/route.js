/**
 * GET /api/billing/plans
 * 
 * Purpose:
 * Return the available subscription plans and their Stripe price IDs.
 * 
 * Authentication:
 * Requires JWT Bearer token.
 * 
 * Response:
 * {
 *   "ok": true,
 *   "plans": {
 *     "starter": "price_xxx",
 *     "growth": "price_xxx",
 *     "enterprise": "price_xxx"
 *   },
 *   "meteredPrice": "price_xxx"
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
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

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function GET(request) {
  try {
    const database = await connect()
    const auth = await requireAuth(request, database)
    if (auth.error) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      )
    }
    
    // Return available plans
    const plans = {
      starter: env.STRIPE?.PRICE_STARTER || null,
      growth: env.STRIPE?.PRICE_GROWTH || null,
      enterprise: env.STRIPE?.PRICE_ENTERPRISE || null
    }
    
    // Check if Stripe is configured
    if (!env.STRIPE) {
      return NextResponse.json(
        { ok: false, error: 'Billing not configured' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      ok: true,
      plans,
      meteredPrice: env.STRIPE?.PRICE_CALL_MINUTE_METERED || null,
      currency: 'CAD'
    })
    
  } catch (error) {
    console.error('[billing/plans] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
