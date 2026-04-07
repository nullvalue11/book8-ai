import { redirect } from 'next/navigation'

/** BOO-81B: Legacy /dashboard/system-status URLs → provisioning (system status) */
export default async function SystemStatusRedirect({ searchParams }) {
  const params = await searchParams
  const raw = params?.businessId
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  redirect(
    id ? `/dashboard/provisioning?businessId=${encodeURIComponent(String(id))}` : '/dashboard/provisioning'
  )
}
