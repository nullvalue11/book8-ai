/**
 * Stripe off-session charges for no-show / late cancellation (BOO-45B).
 * Charges run on the platform Stripe account (Connect payout is a future enhancement).
 */

/**
 * @param {import('stripe').default} stripe
 */
export async function verifySetupIntentForBooking(stripe, setupIntentId, businessId, email) {
  const si = await stripe.setupIntents.retrieve(String(setupIntentId))
  if (si.status !== 'succeeded') {
    return { ok: false, error: 'Card verification incomplete. Please try again.' }
  }
  const meta = si.metadata || {}
  if (String(meta.businessId || '') !== String(businessId || '')) {
    return { ok: false, error: 'Invalid card session' }
  }
  if (String(meta.guestEmail || '').toLowerCase() !== String(email || '').toLowerCase()) {
    return { ok: false, error: 'Email must match the card setup' }
  }
  const pmId =
    typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id
  const custId = typeof si.customer === 'string' ? si.customer : si.customer?.id
  if (!pmId || !custId) {
    return { ok: false, error: 'Could not read payment method' }
  }
  let paymentMethodSummary = { last4: '', brand: '' }
  try {
    const pm = await stripe.paymentMethods.retrieve(pmId)
    paymentMethodSummary = {
      last4: pm.card?.last4 || '',
      brand: pm.card?.brand || ''
    }
  } catch {
    /* best-effort */
  }
  return {
    ok: true,
    stripeCustomerId: custId,
    stripePaymentMethodId: pmId,
    paymentMethodSummary
  }
}

/**
 * @param {import('stripe').default} stripe
 */
export async function createOffSessionCharge(stripe, {
  customerId,
  paymentMethodId,
  amountCents,
  currency,
  metadata
}) {
  const cents = Math.max(0, Math.floor(Number(amountCents) || 0))
  if (cents <= 0) return { ok: true, skipped: true, paymentIntentId: null }
  const cur = String(currency || 'cad').toLowerCase().slice(0, 3) || 'cad'
  try {
    const pi = await stripe.paymentIntents.create({
      amount: cents,
      currency: cur,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    })
    if (pi.status !== 'succeeded') {
      return {
        ok: false,
        error: pi.last_payment_error?.message || 'Payment was not successful'
      }
    }
    return { ok: true, paymentIntentId: pi.id, amountCents: cents }
  } catch (e) {
    return { ok: false, error: e.message || 'Charge failed' }
  }
}
