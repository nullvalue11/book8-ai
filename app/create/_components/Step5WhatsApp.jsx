'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Copy, Download, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  generateWhatsappDeepLink,
  generateWhatsappEmbedSnippet
} from '@/lib/whatsappDeepLink'

const STEP1_KEY = 'book8.wizard.step1'

function readStep1FromSession() {
  try {
    const raw = sessionStorage.getItem(STEP1_KEY)
    if (!raw) return { businessName: 'my business', language: 'en' }
    const rec = JSON.parse(raw)
    const n = rec?.form?.businessName
    const lang = rec?.form?.language
    return {
      businessName: String(n || '').trim() || 'my business',
      language: ['en', 'ar', 'fr', 'es'].includes(lang) ? lang : 'en'
    }
  } catch {
    return { businessName: 'my business', language: 'en' }
  }
}

export default function Step5WhatsApp({ wizardSessionId, businessId = null, onBack, onContinueToSetup }) {
  const { businessName, language: step1Lang } = useMemo(() => readStep1FromSession(), [])
  const businessLike = useMemo(
    () => ({
      businessName,
      name: businessName,
      businessId: businessId || undefined,
      wizardSessionId: wizardSessionId || 'new'
    }),
    [businessName, wizardSessionId, businessId]
  )

  const lang = step1Lang
  const deepLink = useMemo(
    () => generateWhatsappDeepLink(businessLike, { language: lang }),
    [businessLike, lang]
  )
  const embedSnippet = useMemo(
    () => generateWhatsappEmbedSnippet(businessLike, { language: lang }),
    [businessLike, lang]
  )

  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(deepLink, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [deepLink])

  const copyText = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }, [])

  const downloadQr = useCallback(() => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'book8-whatsapp-qr.png'
    a.click()
  }, [qrDataUrl])

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Set up your WhatsApp booking AI</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          Share this link with your customers — they&apos;ll open WhatsApp and book directly with your AI
          assistant, 24/7.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-4 sm:p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Booking link</p>
          <p className="text-sm text-[#94A3B8] break-all leading-relaxed">{deepLink}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => copyText(deepLink, 'Link')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy link
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3 md:w-48 shrink-0">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="QR code for WhatsApp booking link"
                width={192}
                height={192}
                unoptimized
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl border border-white/10 bg-white p-2"
              />
            ) : (
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
              disabled={!qrDataUrl}
              onClick={downloadQr}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Embed on your site</p>
            <pre className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-[#0A0A0F] p-3 text-xs text-[#94A3B8] whitespace-pre-wrap break-all">
              {embedSnippet}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => copyText(embedSnippet, 'Embed code')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy embed HTML
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-3">
          <Button
            type="button"
            className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20BD5A] text-white"
            onClick={() => window.open(deepLink, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Send me a test message
            <ExternalLink className="h-4 w-4 ml-2 opacity-80" />
          </Button>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Opens WhatsApp with a pre-filled message. After you send it, your automation can pick it up once the
            inbound webhook is live.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <p className="text-xs text-[#64748B] text-center sm:text-left sm:flex-1">
          Phone provisioning isn&apos;t required for your region — finish setup to go live.
        </p>
        <Button
          type="button"
          onClick={onContinueToSetup}
          className="h-12 rounded-xl bg-[#8B5CF6] px-8 text-base font-semibold text-white hover:bg-[#7C3AED]"
        >
          Continue to dashboard →
        </Button>
      </div>
    </div>
  )
}
