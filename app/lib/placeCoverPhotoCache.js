/**
 * BOO-106B: fetch Google Place photo via core proxy, upload to Cloudinary, persist on business.googlePlaces.coverPhoto
 */

import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/lib/env'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '@/api/places/_lib/core-places'

const COVER_STALE_MS = 90 * 24 * 60 * 60 * 1000

/**
 * @param {unknown} cachedAt ISO string
 */
export function isCoverPhotoStale(cachedAt) {
  if (cachedAt == null) return true
  const t = new Date(typeof cachedAt === 'string' ? cachedAt : String(cachedAt)).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > COVER_STALE_MS
}

/**
 * @param {Record<string, unknown>} googlePlaces
 * @returns {string | null}
 */
export function firstPhotoReferenceFromGooglePlaces(googlePlaces) {
  if (!googlePlaces || typeof googlePlaces !== 'object') return null
  const photos = googlePlaces.photos
  if (!Array.isArray(photos) || photos.length === 0) return null
  const ph = photos[0]
  if (!ph || typeof ph !== 'object') return null
  const ref =
    /** @type {Record<string, unknown>} */ (ph).reference ||
    /** @type {Record<string, unknown>} */ (ph).photoReference ||
    /** @type {Record<string, unknown>} */ (ph).photo_reference ||
    /** @type {Record<string, unknown>} */ (ph).name
  return typeof ref === 'string' && ref.trim() ? ref.trim().slice(0, 2048) : null
}

/**
 * @param {string} reference
 * @returns {Promise<Buffer>}
 */
export async function fetchPlacePhotoBufferFromCore(reference) {
  if (!corePlacesConfigured()) {
    throw new Error('Places proxy not configured')
  }
  const coreUrl = new URL(`${corePlacesBaseUrl()}/api/places/photo`)
  coreUrl.searchParams.set('reference', reference)
  coreUrl.searchParams.set('maxwidth', '1600')

  const res = await fetch(coreUrl.toString(), {
    headers: corePlacesInternalHeaders(false),
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error(`Photo proxy ${res.status}`)
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * @param {Buffer} buffer
 * @param {string} businessId
 * @returns {Promise<string>} secure HTTPS URL
 */
export async function uploadCoverToCloudinary(buffer, businessId) {
  const cloud = env.CLOUDINARY_CLOUD_NAME
  const key = env.CLOUDINARY_API_KEY
  const secret = env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) {
    throw new Error('Cloudinary not configured')
  }

  cloudinary.config({
    cloud_name: cloud,
    api_key: key,
    api_secret: secret,
    secure: true
  })

  const publicId = `book8-business-${businessId}-cover`
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          public_id: publicId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image'
        },
        (err, res) => (err ? reject(err) : resolve(res))
      )
      .end(buffer)
  })

  const url = /** @type {{ secure_url?: string }} */ (result).secure_url
  if (!url || typeof url !== 'string') {
    throw new Error('Cloudinary upload missing url')
  }
  return url
}

/**
 * Merge core-api sync payload coverPhoto (already on Cloudinary) into stored shape.
 * @param {unknown} raw
 * @returns {{ placeRef?: string, cloudinaryUrl: string, cachedAt: string } | null}
 */
export function coverPhotoFromSyncPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const c = /** @type {Record<string, unknown>} */ (raw)
  const url = typeof c.cloudinaryUrl === 'string' ? c.cloudinaryUrl.trim() : ''
  if (!url || !/^https:\/\//i.test(url)) return null
  const placeRef = typeof c.placeRef === 'string' ? c.placeRef.slice(0, 512) : undefined
  const cachedAt =
    typeof c.cachedAt === 'string' && c.cachedAt
      ? c.cachedAt
      : new Date().toISOString()
  return {
    ...(placeRef ? { placeRef } : {}),
    cloudinaryUrl: url.slice(0, 2048),
    cachedAt
  }
}

/**
 * Ensure googlePlaces.coverPhoto has a fresh Cloudinary URL when possible.
 * @param {import('mongodb').Document | null} googlePlaces
 * @param {string} businessId
 * @returns {Promise<import('mongodb').Document | null>}
 */
export async function ensureCoverPhotoCached(googlePlaces, businessId) {
  if (!googlePlaces || typeof googlePlaces !== 'object') return googlePlaces

  const existing = /** @type {Record<string, unknown>} */ (googlePlaces).coverPhoto
  if (
    existing &&
    typeof existing === 'object' &&
    typeof /** @type {Record<string, unknown>} */ (existing).cloudinaryUrl === 'string' &&
    !isCoverPhotoStale(/** @type {Record<string, unknown>} */ (existing).cachedAt)
  ) {
    return googlePlaces
  }

  const hasCloudinary =
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  if (!hasCloudinary) return googlePlaces

  const ref = firstPhotoReferenceFromGooglePlaces(/** @type {Record<string, unknown>} */ (googlePlaces))
  if (!ref) return googlePlaces

  try {
    const buf = await fetchPlacePhotoBufferFromCore(ref)
    const cloudinaryUrl = await uploadCoverToCloudinary(buf, businessId)
    return {
      ...googlePlaces,
      coverPhoto: {
        placeRef: ref.slice(0, 512),
        cloudinaryUrl,
        cachedAt: new Date().toISOString()
      }
    }
  } catch (e) {
    console.warn('[placeCoverPhotoCache]', businessId, e?.message || e)
    return { ...googlePlaces, coverPhoto: null }
  }
}
