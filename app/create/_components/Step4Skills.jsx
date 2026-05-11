'use client'

import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'

function ChannelPills({ channels }) {
  const ch = channels || { voice: true, whatsapp: true, sms: true }
  return (
    <div className="flex flex-wrap gap-2">
      {ch.voice ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white">
          <Phone className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden />
          AI phone receptionist
        </span>
      ) : null}
      {ch.whatsapp ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white">
          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" aria-hidden />
          WhatsApp booking
        </span>
      ) : null}
      {ch.sms ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white">
          <Mail className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden />
          SMS reminders
        </span>
      ) : null}
    </div>
  )
}

const ALL_CAPABILITIES = [
  {
    id: '247',
    icon: Clock,
    title: '24/7 Availability',
    bodyVoice:
      'Never miss another call. Your AI answers every call, day or night, weekends and holidays included.',
    bodyChat:
      'Your assistant is always on — customers can reach you on WhatsApp day or night, weekends and holidays included.',
    needsVoice: false
  },
  {
    id: 'lang',
    icon: Globe,
    title: '70+ Languages',
    body: 'Auto-detects customer language and responds in their preferred language. English, Spanish, French, Arabic, Mandarin, and 65+ more.',
    needsVoice: false
  },
  {
    id: 'cal',
    icon: Calendar,
    title: 'Calendar Integration',
    body: 'Connects to Google Calendar and Microsoft Outlook. Bookings appear in real time.',
    needsVoice: false
  },
  {
    id: 'sms',
    icon: MessageSquare,
    title: 'SMS Confirmations',
    body: 'Customers receive instant SMS confirmations after booking. Reduces no-shows by ~40%.',
    needsVoice: false,
    needsSms: true
  },
  {
    id: 'lifecycle',
    icon: RefreshCw,
    title: 'Reschedule & Cancel',
    bodyVoice:
      'Handles the full booking lifecycle, not just new appointments. Customers can move bookings via SMS or by calling back.',
    bodyChat:
      'Handles the full booking lifecycle on WhatsApp — reschedule, cancel, and book again without friction.',
    needsVoice: false
  },
  {
    id: 'rev',
    icon: DollarSign,
    title: 'Revenue Recovery',
    bodyVoice:
      'Typical service businesses miss 30–50% of calls during peak hours. Book8 captures them all — averaging $1,200–2,500/month in recovered revenue.',
    bodyChat:
      'Capture demand that would otherwise walk away — your AI books appointments while you focus on clients in the chair.',
    needsVoice: false
  }
]

export default function Step4Skills({ channels, voicePrimary, onBack, onContinue }) {
  const ch = channels || { voice: true, whatsapp: true, sms: true }

  const capabilities = ALL_CAPABILITIES.filter((c) => {
    if (c.needsSms && !ch.sms) return false
    return true
  }).map((c) => {
    const body =
      typeof c.body === 'string'
        ? c.body
        : voicePrimary
          ? c.bodyVoice
          : c.bodyChat || c.bodyVoice
    return { ...c, body }
  })

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          {voicePrimary ? "Here's what your AI can do" : "Here's what your WhatsApp assistant can do"}
        </h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          {voicePrimary
            ? 'Your receptionist is configured and ready. Here are some of its key abilities.'
            : 'Your assistant is configured for your region. Here are some of its key abilities.'}
        </p>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            Channels included in your region
          </p>
          <ChannelPills channels={ch} />
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30">
                    <Icon className="h-5 w-5 text-[#A78BFA]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{c.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#94A3B8] leading-snug">{c.body}</p>
              </div>
            )
          })}
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
          {voicePrimary ? "Almost there — let's test your AI." : 'Next: get your WhatsApp booking link.'}
        </p>
        <Button
          type="button"
          onClick={onContinue}
          className="h-12 rounded-xl bg-[#8B5CF6] px-8 text-base font-semibold text-white hover:bg-[#7C3AED]"
        >
          Continue →
        </Button>
      </div>
    </div>
  )
}
