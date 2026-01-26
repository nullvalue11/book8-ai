'use client';
import Link from 'next/link';
import { Calendar, Shield, Lock } from 'lucide-react';

export default function DataPrivacy() {
  return (
    <div id="data-transparency" className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
              Your Data Privacy Matters
            </h2>
            <p className="text-white/60">
              We are committed to transparency about how we use your information.
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Calendar Access */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-400" />
              Why We Need Access to Your Calendar
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong className="text-white/90">Sync availability:</strong> We read your calendar events to show when you&apos;re available for bookings and prevent double-bookings.</span>
              </li>
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong className="text-white/90">Create appointments:</strong> When someone books time with you, we create a calendar event on your behalf with all the meeting details.</span>
              </li>
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong className="text-white/90">Manage changes:</strong> If a booking is rescheduled or canceled, we update or remove the calendar event automatically.</span>
              </li>
            </ul>
          </div>

          {/* What We DON'T Do */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              What We Never Do With Your Data
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-red-400 mt-1">✗</span>
                <span>We <strong className="text-white/90">never share</strong> your calendar data with third parties</span>
              </li>
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-red-400 mt-1">✗</span>
                <span>We <strong className="text-white/90">never sell</strong> your personal information or usage data</span>
              </li>
              <li className="flex items-start gap-3 text-white/70">
                <span className="text-red-400 mt-1">✗</span>
                <span>We <strong className="text-white/90">never access</strong> calendar data beyond what&apos;s needed for scheduling</span>
              </li>
            </ul>
          </div>

          {/* Privacy Link */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <p className="text-white/50 text-sm">
              For complete details on how we handle your data, please review our privacy policy.
            </p>
            <Link 
              href="/privacy" 
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              <Shield className="w-4 h-4" />
              Read Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
