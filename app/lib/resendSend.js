/**
 * Resend SDK returns `{ data, error }` and does not throw on API/validation errors.
 * Always check the return value (or use this helper) before treating a send as successful.
 */

/**
 * @param {import('resend').Resend} resend
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ ok: true, id?: string } | { ok: false, error: string, statusCode?: number|string, name?: string }>}
 */
export async function sendResendEmail(resend, payload) {
  const result = await resend.emails.send(payload)
  if (result?.error) {
    const errMsg = result.error.message || 'Resend API error'
    const statusCode = result.error.statusCode ?? 'unknown'
    return { ok: false, error: errMsg, statusCode, name: result.error.name }
  }
  return { ok: true, id: result?.data?.id }
}
