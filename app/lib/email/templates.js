/**
 * Email templates with branding
 */

import { env } from '../env'

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png'
const BRAND_COLOR = '#65E0C1'
const ACCENT_COLOR = '#8FD0FF'
const BG_DARK = '#0E1A26'
const SURFACE_DARK = '#1B2733'

const EMAIL_LABELS = {
  en: {
    subject: (biz) => `Booking Confirmed — ${biz}`,
    title: 'Booking Confirmed! 🎉',
    bodyConfirmed: (host) => `Your booking with <strong>${host}</strong> has been confirmed.`,
    seeYou: 'See you then',
    yourTime: 'Your Time:',
    hostTime: "Host's Time:",
    notes: 'Notes:',
    addCalendar: 'Add to your calendar:',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    needChanges: 'Need to make changes?',
    reschedule: 'Reschedule',
    cancelBooking: 'Cancel Booking',
    cancelNote: 'Need to cancel?',
    cancelInstruction: (phone) =>
      phone
        ? `Text <strong>CANCEL BOOKING</strong> to ${phone}, or call us to reschedule.`
        : 'Use the cancellation link in this email.'
  },
  fr: {
    subject: (biz) => `Rendez-vous confirmé — ${biz}`,
    title: 'Rendez-vous confirmé ! 🎉',
    bodyConfirmed: (host) => `Votre rendez-vous avec <strong>${host}</strong> est confirmé.`,
    seeYou: 'À bientôt',
    yourTime: 'Votre heure :',
    hostTime: "Heure de l'hôte :",
    notes: 'Notes :',
    addCalendar: 'Ajoutez à votre calendrier',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    needChanges: 'Besoin de modifier ?',
    reschedule: 'Reporter',
    cancelBooking: 'Annuler le rendez-vous',
    cancelNote: "Besoin d'annuler ?",
    cancelInstruction: (phone) =>
      phone
        ? `Envoyez <strong>CANCEL BOOKING</strong> au ${phone}, ou appelez-nous pour reporter.`
        : "Utilisez le lien d'annulation dans ce courriel."
  },
  es: {
    subject: (biz) => `Cita confirmada — ${biz}`,
    title: '¡Cita confirmada! 🎉',
    bodyConfirmed: (host) => `Su cita con <strong>${host}</strong> está confirmada.`,
    seeYou: 'Nos vemos',
    yourTime: 'Su hora:',
    hostTime: 'Hora del anfitrión:',
    notes: 'Notas:',
    addCalendar: 'Agregue a su calendario',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    needChanges: '¿Necesita hacer cambios?',
    reschedule: 'Reprogramar',
    cancelBooking: 'Cancelar cita',
    cancelNote: '¿Necesita cancelar?',
    cancelInstruction: (phone) =>
      phone
        ? `Envíe <strong>CANCEL BOOKING</strong> al ${phone}, o llámenos para reprogramar.`
        : 'Use el enlace de cancelación en este correo.'
  },
  ar: {
    subject: (biz) => `تم تأكيد الحجز — ${biz}`,
    title: 'تم تأكيد الحجز! 🎉',
    bodyConfirmed: (host) => `تم تأكيد حجزك مع <strong>${host}</strong>.`,
    seeYou: 'نراك قريباً',
    yourTime: 'وقتك:',
    hostTime: 'وقت المضيف:',
    notes: 'ملاحظات:',
    addCalendar: 'أضف إلى تقويمك',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    needChanges: 'هل تحتاج إلى تغيير الموعد؟',
    reschedule: 'إعادة الجدولة',
    cancelBooking: 'إلغاء الحجز',
    cancelNote: 'هل تحتاج للإلغاء؟',
    cancelInstruction: (phone) =>
      phone
        ? `أرسل <strong>CANCEL BOOKING</strong> إلى ${phone}، أو اتصل بنا لإعادة الجدولة.`
        : 'استخدم رابط الإلغاء في هذا البريد الإلكتروني.'
  }
}

export function getEmailLabels(language) {
  const lang = (language || 'en').toLowerCase().slice(0, 2)
  return EMAIL_LABELS[lang] || EMAIL_LABELS.en
}

function getEmailLocaleTag(language) {
  const l = (language || 'en').toLowerCase().slice(0, 2)
  if (l === 'ar') return 'ar'
  if (l === 'fr') return 'fr'
  if (l === 'es') return 'es'
  return 'en-US'
}

export function bookingConfirmationResendSubject({ businessLabel, startTime, guestTzLabel, language }) {
  const labels = getEmailLabels(language)
  const tz = guestTzLabel || 'UTC'
  const dateStr = new Date(startTime).toLocaleString(getEmailLocaleTag(language), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz
  })
  return `${labels.subject(businessLabel)} · ${dateStr} (${tz})`
}

/**
 * Base email template with branding
 */
function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Book8 AI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: ${BG_DARK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_DARK}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${SURFACE_DARK}; border-radius: 8px; border: 1px solid #2E3A47; overflow: hidden;">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, ${ACCENT_COLOR}); padding: 48px 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="Book8 AI" style="height: 80px; width: auto; padding: 24px;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px; color: #FFFFFF;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BG_DARK}; padding: 24px 32px; text-align: center; border-top: 1px solid #2E3A47;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #B6C4D1; font-weight: 500;">
                Powered by <span style="background: linear-gradient(135deg, ${BRAND_COLOR}, ${ACCENT_COLOR}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 600;">Book8 AI</span>
              </p>
              <p style="margin: 0; font-size: 12px; color: #B6C4D1;">
                Intelligent Booking & Automation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Format date/time with timezone
 */
function formatPhoneForEmail(phone) {
  if (phone == null || String(phone).trim() === '') return ''
  const raw = String(phone).trim()
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function formatDateTime(dateTime, timezone, language = 'en') {
  const date = new Date(dateTime)
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short'
  }
  return date.toLocaleString(getEmailLocaleTag(language), options)
}

/**
 * Calendar button helper — Google + Outlook (brand labels stay EN per product)
 */
function calendarButtons(booking, baseUrl, labels) {
  const title = encodeURIComponent(booking.title)
  const startUTC = new Date(booking.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const endUTC = new Date(booking.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const details = encodeURIComponent((booking.notes || '') + '\n\nBooked via Book8 AI')

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUTC}/${endUTC}&details=${details}`
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${encodeURIComponent(booking.startTime)}&enddt=${encodeURIComponent(booking.endTime)}&body=${details}`

  return `
    <div style="margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">${labels.addCalendar}</p>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
        <a href="${googleUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          ${labels.googleCalendar}
        </a>
        <a href="${outlookUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${ACCENT_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          ${labels.outlook}
        </a>
      </div>
    </div>
  `
}

/**
 * Booking confirmation email
 * @param {string} [handle] - Booking page handle for reschedule URL (e.g. from /b/{handle}/reschedule)
 */
export function bookingConfirmationEmail(
  booking,
  owner,
  baseUrl,
  rescheduleToken,
  cancelToken,
  guestTz = null,
  handle = null,
  businessPhone = null,
  language = 'en'
) {
  const langKey = (language || 'en').toLowerCase().slice(0, 2)
  const labels = getEmailLabels(langKey)
  const isRtl = langKey === 'ar'
  const dirStyle = isRtl ? 'direction: rtl; text-align: right;' : ''

  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  const guestName = booking.customerName || booking.guestEmail || 'there'
  const hostLine = owner.name || owner.email
  const rescheduleHandle = handle || owner.scheduling?.handle || ''
  const rescheduleUrl = rescheduleHandle
    ? `${baseUrl}/b/${rescheduleHandle}/reschedule?token=${rescheduleToken}`
    : rescheduleToken
      ? `${baseUrl}/bookings/reschedule/${rescheduleToken}`
      : ''
  const phoneDisplay = formatPhoneForEmail(businessPhone)
  const cancelDetailHtml =
    typeof labels.cancelInstruction === 'function'
      ? labels.cancelInstruction(phoneDisplay || '')
      : String(labels.cancelInstruction)

  const innerContent = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827;">
      ${labels.title}
    </h1>

    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
      ${labels.bodyConfirmed(hostLine)}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
      ${labels.seeYou}, ${guestName}!
    </p>

    <div style="background-color: #f9fafb; border-left: 4px solid ${BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 8px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${booking.title}
      </h2>

      <div style="margin-bottom: 12px;">
        <strong style="color: #6b7280;">${labels.yourTime}</strong>
        <p style="margin: 4px 0 0 0; font-size: 15px; color: #111827;">
          📅 ${formatDateTime(booking.startTime, displayTz, langKey)}
        </p>
      </div>

      ${guestTz && guestTz !== hostTz
        ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #6b7280;">${labels.hostTime}</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #6b7280;">
            ${formatDateTime(booking.startTime, hostTz, langKey)}
          </p>
        </div>
      `
        : ''}

      ${booking.notes
        ? `
        <div style="margin-top: 16px;">
          <strong style="color: #6b7280;">${labels.notes}</strong>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;">
            ${booking.notes}
          </p>
        </div>
      `
        : ''}
    </div>

    ${calendarButtons(booking, baseUrl, labels)}

    <div style="margin: 32px 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
        ${labels.needChanges}
      </p>

      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">${labels.cancelNote}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">${cancelDetailHtml}</p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        ${rescheduleToken && rescheduleUrl
          ? `
          <a href="${rescheduleUrl}" style="display: inline-block; padding: 10px 20px; background-color: ${ACCENT_COLOR}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
            ${labels.reschedule}
          </a>
        `
          : ''}

        <a href="${baseUrl}/api/public/bookings/cancel?token=${cancelToken}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
          ${labels.cancelBooking}
        </a>
      </div>
    </div>
  `

  const content = `<div style="${dirStyle}">${innerContent}</div>`

  return baseTemplate(content)
}

/**
 * Reminder email template
 */
export function reminderEmail(booking, owner, hoursUntil, guestTz = null) {
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827;">
      Reminder: Upcoming Booking ⏰
    </h1>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
      Your booking with <strong>${owner.name || owner.email}</strong> is in <strong>${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}</strong>.
    </p>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 8px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #92400e;">
        ${booking.title}
      </h2>
      
      <div style="margin-bottom: 12px;">
        <strong style="color: #78350f;">${labels.yourTime}</strong>
        <p style="margin: 4px 0 0 0; font-size: 15px; color: #92400e;">
          📅 ${formatDateTime(booking.startTime, displayTz, langKey)}
        </p>
      </div>
      
      ${guestTz && guestTz !== hostTz ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #78350f;">${labels.hostTime}</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #a16207;">
            ${formatDateTime(booking.startTime, hostTz, langKey)}
          </p>
        </div>
      ` : ''}
    </div>
    
    ${calendarButtons(booking, env.BASE_URL, labels)}
  `
  
  return baseTemplate(content)
}

/**
 * Reschedule confirmation email
 */
export function rescheduleConfirmationEmail(booking, owner, rescheduleCount, baseUrl, rescheduleToken, cancelToken, guestTz = null) {
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  const remainingReschedules = 3 - rescheduleCount
  
  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827;">
      Booking Rescheduled ✅
    </h1>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
      Your booking with <strong>${owner.name || owner.email}</strong> has been rescheduled to a new time.
    </p>
    
    <div style="background-color: #f0f9ff; border-left: 4px solid ${ACCENT_COLOR}; padding: 20px; margin: 24px 0; border-radius: 8px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #075985;">
        ${booking.title}
      </h2>
      
      <div style="margin-bottom: 12px;">
        <strong style="color: #0c4a6e;">New Time (Your Timezone):</strong>
        <p style="margin: 4px 0 0 0; font-size: 15px; color: #075985;">
          📅 ${formatDateTime(booking.startTime, displayTz, langKey)}
        </p>
      </div>
      
      ${guestTz && guestTz !== hostTz ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #0c4a6e;">${labels.hostTime}</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #0369a1;">
            ${formatDateTime(booking.startTime, hostTz, langKey)}
          </p>
        </div>
      ` : ''}
    </div>
    
    ${calendarButtons(booking, baseUrl, labels)}
    
    ${remainingReschedules > 0 ? `
      <div style="margin: 24px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          ℹ️ You have <strong>${remainingReschedules}</strong> reschedule${remainingReschedules > 1 ? 's' : ''} remaining for this booking.
        </p>
      </div>
    ` : ''}
    
    <div style="margin: 32px 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <a href="${baseUrl}/api/public/bookings/cancel?token=${cancelToken}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        ${labels.cancelBooking}
      </a>
    </div>
  `
  
  return baseTemplate(content)
}
