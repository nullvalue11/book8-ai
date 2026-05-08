'use client'

import { ArrowLeft, Calendar, Clock, DollarSign, Globe, MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CAPABILITIES = [
  {
    icon: Clock,
    title: '24/7 Availability',
    body: 'Never miss another call. Your AI answers every call, day or night, weekends and holidays included.'
  },
  {
    icon: Globe,
    title: '70+ Languages',
    body: 'Auto-detects caller language and responds in their preferred language. English, Spanish, French, Arabic, Mandarin, and 65+ more.'
  },
  {
    icon: Calendar,
    title: 'Calendar Integration',
    body: 'Connects to Google Calendar and Microsoft Outlook. Bookings appear in real time.'
  },
  {
    icon: MessageSquare,
    title: 'SMS Confirmations',
    body: 'Customers receive instant SMS confirmations after booking. Reduces no-shows by ~40%.'
  },
  {
    icon: RefreshCw,
    title: 'Reschedule & Cancel',
    body: 'Handles the full booking lifecycle, not just new appointments. Customers can move bookings via SMS or by calling back.'
  },
  {
    icon: DollarSign,
    title: 'Revenue Recovery',
    body: 'Typical service businesses miss 30–50% of calls during peak hours. Book8 captures them all — averaging $1,200–2,500/month in recovered revenue.'
  }
]

export default function Step4Skills({ onBack, onContinue }) {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Here's what your AI can do</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">Your receptionist is configured and ready. Here are some of its key abilities.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.title} className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-5">
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
          Almost there — let's test your AI.
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

