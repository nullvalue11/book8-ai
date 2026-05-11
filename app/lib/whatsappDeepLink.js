/**
 * WhatsApp wa.me deep links for Book8 shared inbound number (BOO-WIZARD-COUNTRY-BRANCH-1B).
 */

/** E.164 without + — Book8 WhatsApp Business number (prod). */
export const BOOK8_WHATSAPP_NUMBER = '15557900235'

/**
 * @param {{ name?: string, businessName?: string, businessId?: string, id?: string, _id?: string, wizardSessionId?: string }} businessLike
 * @param {{ language?: string, buttonText?: string }} [options]
 */
export function buildBookingToken(businessLike) {
  const bid =
    businessLike?.businessId || businessLike?.id || businessLike?._id || null
  if (typeof bid === 'string' && bid.trim() && !/^pending$/i.test(bid.trim())) {
    return `[BIZ:${bid.trim()}]`
  }
  const w = businessLike?.wizardSessionId || 'new'
  return `[WIZARD:${String(w).trim()}]`
}

export function generateWhatsappDeepLink(businessLike, options = {}) {
  const { language = 'en' } = options
  const name =
    businessLike?.name ||
    businessLike?.businessName ||
    'my business'

  const greetings = {
    en: `Hi! I'd like to book an appointment at ${name}.`,
    ar: `مرحباً! أرغب في حجز موعد لدى ${name}.`,
    fr: `Bonjour ! Je souhaite réserver un rendez-vous chez ${name}.`,
    es: `¡Hola! Me gustaría reservar una cita en ${name}.`
  }

  const greeting = greetings[language] || greetings.en
  const token = buildBookingToken(businessLike)
  const fullText = `${greeting} ${token}`

  return `https://wa.me/${BOOK8_WHATSAPP_NUMBER}?text=${encodeURIComponent(fullText)}`
}

export function generateWhatsappEmbedSnippet(businessLike, options = {}) {
  const link = generateWhatsappDeepLink(businessLike, options)
  const buttonText = options.buttonText || 'Book on WhatsApp'
  return `<a href="${link}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:white;padding:12px 24px;border-radius:9999px;font-weight:600;text-decoration:none;font-family:system-ui,sans-serif;">
  ${buttonText}
</a>`
}
