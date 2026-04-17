/**
 * BOO-109A — Resend send + notifications.sent stamp (import-light module for node:test).
 * Resend may return result.error instead of throwing; DB stamp runs only after success.
 */
export async function deliverWelcomeEmailAndStamp(params) {
  const { collection, businessDoc, sendPayload, resendSend, logAddresses } = params
  const { to, from } = logAddresses

  try {
    const result = await resendSend(sendPayload)

    if (result?.error) {
      const errMsg = result.error.message || 'Resend API error'
      const statusCode = result.error.statusCode || 'unknown'
      console.error('[welcome-email] resend rejected:', {
        to,
        from,
        statusCode,
        errMsg,
        name: result.error.name
      })
      return { ok: false, error: errMsg, statusCode }
    }

    const messageId = result?.data?.id
    console.log('[welcome-email] sent:', { to, messageId })

    await collection.updateOne(
      { _id: businessDoc._id },
      {
        $push: {
          'notifications.sent': {
            type: 'welcome-email',
            sentAt: new Date(),
            channel: 'email'
          }
        }
      }
    )

    return { ok: true, sent: true, messageId }
  } catch (e) {
    console.error('[welcome-email] threw:', { to, message: e?.message || String(e) })
    return { ok: false, error: e?.message || 'unknown error' }
  }
}
