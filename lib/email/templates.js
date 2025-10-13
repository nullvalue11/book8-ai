/**
 * Email templates with branding
 */

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png'
const BRAND_COLOR = '#3b82f6'
const ACCENT_COLOR = '#06b6d4'

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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, ${ACCENT_COLOR}); padding: 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="Book8 AI" style="height: 60px; width: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                Powered by <strong style="color: ${BRAND_COLOR};">Book8 AI</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
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
function formatDateTime(dateTime, timezone) {
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
  return date.toLocaleString('en-US', options)
}

/**
 * Calendar button helper
 */
function calendarButtons(booking, baseUrl) {
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(booking.title)}&dates=${new Date(booking.startTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${new Date(booking.endTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(booking.notes || '')}`
  
  return `
    <div style="margin: 24px 0; text-align: center;">
      <a href="${googleUrl}" target="_blank" style="display: inline-block; margin: 0 8px; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Add to Google Calendar
      </a>
    </div>
  `
}

/**
 * Booking confirmation email
 */
export function bookingConfirmationEmail(booking, owner, baseUrl, rescheduleToken, cancelToken, guestTz = null) {
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const content = `
    <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827;">
      Booking Confirmed! 🎉
    </h1>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
      Your booking with <strong>${owner.name || owner.email}</strong> has been confirmed.
    </p>
    
    <div style="background-color: #f9fafb; border-left: 4px solid ${BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 8px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${booking.title}
      </h2>
      
      <div style="margin-bottom: 12px;">
        <strong style="color: #6b7280;">Your Time:</strong>
        <p style="margin: 4px 0 0 0; font-size: 15px; color: #111827;">
          📅 ${formatDateTime(booking.startTime, displayTz)}
        </p>
      </div>
      
      ${guestTz && guestTz !== hostTz ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #6b7280;">Host's Time:</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #6b7280;">
            ${formatDateTime(booking.startTime, hostTz)}
          </p>
        </div>
      ` : ''}
      
      ${booking.notes ? `
        <div style="margin-top: 16px;">
          <strong style="color: #6b7280;">Notes:</strong>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;">
            ${booking.notes}
          </p>
        </div>
      ` : ''}
    </div>
    
    ${calendarButtons(booking, baseUrl)}
    
    <div style="margin: 32px 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
        Need to make changes?
      </p>
      
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        ${rescheduleToken ? `
          <a href="${baseUrl}/reschedule?token=${rescheduleToken}" style="display: inline-block; padding: 10px 20px; background-color: ${ACCENT_COLOR}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Reschedule
          </a>
        ` : ''}
        
        <a href="${baseUrl}/api/public/bookings/cancel?token=${cancelToken}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Cancel Booking
        </a>
      </div>
    </div>
  `
  
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
        <strong style="color: #78350f;">Your Time:</strong>
        <p style="margin: 4px 0 0 0; font-size: 15px; color: #92400e;">
          📅 ${formatDateTime(booking.startTime, displayTz)}
        </p>
      </div>
      
      ${guestTz && guestTz !== hostTz ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #78350f;">Host's Time:</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #a16207;">
            ${formatDateTime(booking.startTime, hostTz)}
          </p>
        </div>
      ` : ''}
    </div>
    
    ${calendarButtons(booking, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')}
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
          📅 ${formatDateTime(booking.startTime, displayTz)}
        </p>
      </div>
      
      ${guestTz && guestTz !== hostTz ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #0c4a6e;">Host's Time:</strong>
          <p style="margin: 4px 0 0 0; font-size: 15px; color: #0369a1;">
            ${formatDateTime(booking.startTime, hostTz)}
          </p>
        </div>
      ` : ''}
    </div>
    
    ${calendarButtons(booking, baseUrl)}
    
    ${remainingReschedules > 0 ? `
      <div style="margin: 24px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          ℹ️ You have <strong>${remainingReschedules}</strong> reschedule${remainingReschedules > 1 ? 's' : ''} remaining for this booking.
        </p>
      </div>
    ` : ''}
    
    <div style="margin: 32px 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <a href="${baseUrl}/api/public/bookings/cancel?token=${cancelToken}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        Cancel Booking
      </a>
    </div>
  `
  
  return baseTemplate(content)
}
