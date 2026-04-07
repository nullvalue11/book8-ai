import { redirect } from 'next/navigation'

/** BOO-81B: Legacy /dashboard/business-settings URLs → real settings page */
export default async function BusinessSettingsRedirect({ searchParams }) {
  const params = await searchParams
  const raw = params?.businessId
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  redirect(
    id ? `/dashboard/settings?businessId=${encodeURIComponent(String(id))}` : '/dashboard/settings'
  )
}
