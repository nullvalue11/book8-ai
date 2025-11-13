import env from '@/lib/env'
import { createEvent } from 'ics'

export async function sendBookingConfirmation(booking) {
  try {
    if (!env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not configured, skipping email')
      return { success: false, error: 'Email not configured' }
    }

    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    const baseUrl = env.BASE_URL || 'https://book8-ai.vercel.app'
    const cancelUrl = `${baseUrl}/b/${booking.handle}/cancel?token=${booking.cancelToken}`
    const rescheduleUrl = `${baseUrl}/b/${booking.handle}/reschedule?token=${booking.rescheduleToken}`

    // Generate ICS file
    const icsContent = await generateICS(booking)

    // Format dates for display
    const startDate = new Date(booking.start)
    const endDate = new Date(booking.end)
    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: booking.timezone
    })
    const timeStr = `${startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: booking.timezone
    })} - ${endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: booking.timezone,
      timeZoneName: 'short'
    })}`

    // Email to guest
    const guestHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(90deg, #7C4DFF 0%, #9867FF 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #7C4DFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; }
            .button-secondary { background: #6c757d; }
            .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7C4DFF; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Meeting Confirmed</h1>
            </div>
            <div class="content">
              <p>Hi ${booking.guestName},</p>
              <p>Your meeting with <strong>${booking.hostName}</strong> has been confirmed!</p>
              
              <div class="details">
                <h3 style="margin-top: 0;">📅 Meeting Details</h3>
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Time:</strong> ${timeStr}</p>
                ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
              </div>

              <p><strong>What's next?</strong></p>
              <ul>
                <li>Check your email for a calendar invitation (.ics file)</li>
                <li>Add this meeting to your calendar</li>
                <li>Join at the scheduled time</li>
              </ul>

              <div style="margin-top: 30px;">
                <p><strong>Need to make changes?</strong></p>
                <a href="${rescheduleUrl}" class="button">Reschedule Meeting</a>
                <a href="${cancelUrl}" class="button button-secondary">Cancel Meeting</a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                We've sent a calendar invitation to help you remember this meeting.
              </p>
            </div>
            <div class="footer">
              <p>Powered by Book8 AI</p>
              <p>This is an automated confirmation email.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Email to host
    const hostHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(90deg, #7C4DFF 0%, #9867FF 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #7C4DFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
            .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7C4DFF; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎉 New Booking!</h1>
            </div>
            <div class="content">
              <p>Hi ${booking.hostName},</p>
              <p>You have a new booking from <strong>${booking.guestName}</strong>.</p>
              
              <div class="details">
                <h3 style="margin-top: 0;">📅 Meeting Details</h3>
                <p><strong>Guest:</strong> ${booking.guestName} (${booking.guestEmail})</p>
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Time:</strong> ${timeStr}</p>
                ${booking.notes ? `<p><strong>Guest Notes:</strong> ${booking.notes}</p>` : ''}
              </div>

              ${booking.googleEventLink ? `
                <div style="margin-top: 30px;">
                  <a href="${booking.googleEventLink}" class="button">Open in Google Calendar</a>
                </div>
              ` : ''}

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                This meeting has been automatically added to your Google Calendar.
              </p>
            </div>
            <div class="footer">
              <p>Powered by Book8 AI</p>
              <p>This is an automated notification.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const emailFrom = env.EMAIL_FROM || 'Book8 AI <noreply@book8-ai.vercel.app>'

    // Send email to guest
    await resend.emails.send({
      from: emailFrom,
      to: booking.guestEmail,
      subject: `Meeting confirmed with ${booking.hostName}`,
      html: guestHtml,
      attachments: icsContent ? [{
        filename: 'meeting.ics',
        content: Buffer.from(icsContent).toString('base64')
      }] : []
    })

    // Send email to host
    await resend.emails.send({
      from: emailFrom,
      to: booking.hostEmail,
      subject: `New booking: ${booking.guestName} at ${timeStr}`,
      html: hostHtml,
      attachments: icsContent ? [{
        filename: 'meeting.ics',
        content: Buffer.from(icsContent).toString('base64')
      }] : []
    })

    console.log('[email] Booking confirmations sent successfully')
    return { success: true }

  } catch (error) {
    console.error('[email] Failed to send booking confirmation:', error)
    return { success: false, error: error.message }
  }
}

async function generateICS(booking) {
  try {
    const start = new Date(booking.start)
    const end = new Date(booking.end)

    const event = {
      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
      end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
      title: `Meeting with ${booking.guestName}`,
      description: booking.notes || 'Meeting booked via Book8 AI',
      location: 'Online',
      status: 'CONFIRMED',
      organizer: { name: booking.hostName, email: booking.hostEmail },
      attendees: [
        { name: booking.hostName, email: booking.hostEmail, rsvp: true },
        { name: booking.guestName, email: booking.guestEmail, rsvp: true }
      ],
      alarms: [
        { action: 'display', trigger: { minutes: 10, before: true }, description: 'Meeting reminder' }
      ]
    }

    return new Promise((resolve, reject) => {
      createEvent(event, (error, value) => {
        if (error) {
          console.error('[ics] Generation failed:', error)
          reject(error)
        } else {
          resolve(value)
        }
      })
    })
  } catch (error) {
    console.error('[ics] Error generating ICS:', error)
    return null
  }
}
