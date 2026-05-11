'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Copy, Download, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  generateWhatsappDeepLink,
  generateWhatsappEmbedSnippet
} from '@/lib/whatsappDeepLink'

function mapPrimaryLangToDeepLinkLang(primary) {
  const s = String(primary || '')
    .trim()
    .toLowerCase()
  if (s.startsWith('ar')) return 'ar'
  if (s.startsWith('fr')) return 'fr'
  if (s.startsWith('es')) return 'es'
  return 'en'
}

/**
 * UAE / voice-blocked regions: WhatsApp booking link + QR + embed (setup wizard step 6).
 */
export default function SetupWhatsAppChannelStep({
  businessName,
  businessId,
  primaryLanguage,
  onBack,
  onContinue,
  outlineBtnClass,
  primaryBtnClass
}) {
  const lang = useMemo(() => mapPrimaryLangToDeepLinkLang(primaryLanguage), [primaryLanguage])
  const businessLike = useMemo(
    () => ({
      name: businessName || 'my business',
      businessName: businessName || 'my business',
      businessId: businessId || undefined
    }),
    [businessName, businessId]
  )

  const deepLink = useMemo(() => generateWhatsappDeepLink(businessLike, { language: lang }), [businessLike, lang])
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Set up your WhatsApp booking AI</h1>
        <p className="text-[#94A3B8] mt-1">
          Share this link with your customers — they&apos;ll open WhatsApp and book directly with your AI assistant,
          24/7.
        </p>
      </div>

      <div className="rounded-xl border border-[#1e1e2e] bg-[#0A0A0F]/60 p-5 space-y-5">
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0A0A0F] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Booking link</p>
          <p className="text-sm text-[#94A3B8] break-all leading-relaxed">{deepLink}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={outlineBtnClass}
            onClick={() => copyText(deepLink, 'Link')}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy link
          </Button>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3 md:w-48 shrink-0 mx-auto md:mx-0">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="QR code for WhatsApp booking link"
                width={192}
                height={192}
                unoptimized
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl border border-[#1e1e2e] bg-white p-2"
              />
            ) : (
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl border border-[#1e1e2e] bg-white/5 animate-pulse" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={outlineBtnClass}
              disabled={!qrDataUrl}
              onClick={downloadQr}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Embed on your site</p>
            <pre className="max-h-40 overflow-auto rounded-lg border border-[#1e1e2e] bg-[#0A0A0F] p-3 text-xs text-[#94A3B8] whitespace-pre-wrap break-all">
              {embedSnippet}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={outlineBtnClass}
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
            Opens WhatsApp with a pre-filled message. Continue when you&apos;re ready — your automation can pick it up
            once the inbound webhook is live.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" className={outlineBtnClass} onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button type="button" className={primaryBtnClass} onClick={onContinue}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
