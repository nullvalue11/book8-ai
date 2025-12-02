import { NextResponse } from 'next/server'
import { env, isFeatureEnabled } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const to = searchParams.get('to')
    
    if (!to) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing ?to= parameter' 
      }, { status: 400 })
    }

    // Check environment
    const envCheck = {
      hasApiKey: !!env.RESEND_API_KEY,
      apiKeyLength: env.RESEND_API_KEY?.length || 0,
      resendEnabled: isFeatureEnabled('RESEND'),
      baseUrl: env.BASE_URL
    }

    console.log('[debug/test-email] Environment check', envCheck)

    if (!env.RESEND_API_KEY) {
      return NextResponse.json({
        ok: false,
        error: 'RESEND_API_KEY not configured',
        env: envCheck
      }, { status: 500 })
    }

    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)

    console.log('[debug/test-email] Sending test email', {
      to,
      from: 'Book8 AI <bookings@book8.io>'
    })

    try {
      const result = await resend.emails.send({
        from: 'Book8 AI <bookings@book8.io>',
        to,
        subject: 'Book8 AI Test Email - Production',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>✅ Test Email from Book8 AI</h2>
            <p>This is a production test email from Book8 AI.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>From:</strong> Book8 AI &lt;bookings@book8.ai&gt;</p>
            <p><strong>To:</strong> ${to}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              If you received this email, Resend is working correctly in production!
            </p>
          </div>
        `
      })

      console.log('[debug/test-email] Resend SUCCESS', {
        id: result?.id,
        data: result
      })

      return NextResponse.json({
        ok: true,
        message: 'Email sent successfully',
        result: {
          id: result?.id,
          to,
          from: 'Book8 AI <bookings@book8.io>',
          timestamp: new Date().toISOString()
        },
        env: envCheck
      })

    } catch (err) {
      console.error('[debug/test-email] Resend FAILED', {
        message: err?.message,
        name: err?.name,
        code: err?.code,
        statusCode: err?.statusCode,
        stack: err?.stack
      })

      return NextResponse.json({
        ok: false,
        error: 'Failed to send email',
        details: {
          message: err?.message,
          name: err?.name,
          code: err?.code,
          statusCode: err?.statusCode
        },
        env: envCheck
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[debug/test-email] Outer error', error)
    return NextResponse.json({
      ok: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}
