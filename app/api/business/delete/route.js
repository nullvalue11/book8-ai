/**
 * DELETE /api/business/delete
 * 
 * Removes a business that doesn't have an active subscription.
 * businessId is passed in the request body.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cachedClient = null
let cachedDb = null

async function connectToDatabase() {
  if (cachedDb) return cachedDb
  
  const client = await MongoClient.connect(env.MONGO_URL)
  cachedClient = client
  cachedDb = client.db(env.DB_NAME)
  return cachedDb
}

// POST - Delete a business (using POST because some proxies block DELETE)
export async function POST(request) {
  console.log('[api/business/delete] ========== DELETE REQUEST ==========')
  
  try {
    // Get businessId from request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid JSON body' 
      }, { status: 400 })
    }
    
    const { businessId } = body
    console.log('[api/business/delete] businessId:', businessId)
    
    if (!businessId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'businessId is required' 
      }, { status: 400 })
    }
    
    // Authenticate user
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    
    if (!token) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }
    
    let userId
    try {
      const payload = jwt.verify(token, env.JWT_SECRET)
      userId = payload.sub
      console.log('[api/business/delete] Authenticated user:', userId)
    } catch (err) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid or expired token' 
      }, { status: 401 })
    }
    
    // Get database
    const db = await connectToDatabase()
    
    // Get business
    const business = await db.collection('businesses').findOne({ businessId })
    
    if (!business) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Business not found' 
      }, { status: 404 })
    }
    
    // Verify ownership
    if (business.ownerUserId !== userId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Access denied - not business owner' 
      }, { status: 403 })
    }
    
    // Check subscription status - only allow deletion if no active subscription
    const subscriptionStatus = business.subscription?.status
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Cannot delete business with active subscription. Please cancel subscription first.' 
      }, { status: 400 })
    }
    
    // Delete the business
    console.log('[api/business/delete] Deleting business:', businessId)
    const result = await db.collection('businesses').deleteOne({ businessId })
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to delete business' 
      }, { status: 500 })
    }
    
    console.log('[api/business/delete] Business deleted successfully')
    
    return NextResponse.json({
      ok: true,
      message: 'Business deleted successfully',
      businessId
    })
    
  } catch (error) {
    console.error('[api/business/delete] ERROR:', error.message)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
