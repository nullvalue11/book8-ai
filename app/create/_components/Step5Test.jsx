'use client'

import { ArrowLeft, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Step5Test({ onBack, onContinueToSetup }) {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Test your AI receptionist</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          In a moment, you'll be able to call a test number and hear your AI live.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
            <Phone className="h-6 w-6 text-[#94A3B8]" aria-hidden />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-white">Live agent test coming soon</h3>
          <p className="mt-2 text-sm text-[#94A3B8] leading-snug max-w-[52ch]">
            We're putting the finishing touches on the live test experience. Your AI is fully configured and will go live as soon as you complete setup.
            You can always test it from your dashboard once it's provisioned.
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-[#94A3B8]">
            Coming soon
          </span>
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
          Step 6-7 (Phone + Launch) will be available in your dashboard.
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

