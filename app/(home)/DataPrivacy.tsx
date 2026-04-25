'use client';
import Link from 'next/link';
import { Calendar, Shield, Lock } from 'lucide-react';

export default function DataPrivacy() {
  return (
    <div id="data-transparency" className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.02] dark:shadow-none md:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-green-500/20">
            <Shield className="h-6 w-6 text-emerald-700 dark:text-green-400" />
          </div>
          <div>
            <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white md:text-2xl">
              Your Data Privacy Matters
            </h2>
            <p className="text-slate-600 dark:text-white/60">
              We are committed to transparency about how we use your information.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Calendar Access */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Calendar className="h-5 w-5 shrink-0 text-violet-600 dark:text-brand-400" />
              Why We Need Access to Your Calendar
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-emerald-600 dark:text-green-400">✓</span>
                <span>
                  <strong className="text-slate-900 dark:text-white/90">Sync availability:</strong> We read your
                  calendar events to show when you&apos;re available for bookings and prevent double-bookings.
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-emerald-600 dark:text-green-400">✓</span>
                <span>
                  <strong className="text-slate-900 dark:text-white/90">Create appointments:</strong> When someone
                  books time with you, we create a calendar event on your behalf with all the meeting details.
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-emerald-600 dark:text-green-400">✓</span>
                <span>
                  <strong className="text-slate-900 dark:text-white/90">Manage changes:</strong> If a booking is
                  rescheduled or canceled, we update or remove the calendar event automatically.
                </span>
              </li>
            </ul>
          </div>

          {/* What We DON'T Do */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-6 dark:border-red-500/20 dark:bg-red-500/5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Lock className="h-5 w-5 shrink-0 text-rose-600 dark:text-red-400" />
              What We Never Do With Your Data
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-rose-600 dark:text-red-400">✗</span>
                <span>
                  We <strong className="text-slate-900 dark:text-white/90">never share</strong> your calendar data with
                  third parties
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-rose-600 dark:text-red-400">✗</span>
                <span>
                  We <strong className="text-slate-900 dark:text-white/90">never sell</strong> your personal information
                  or usage data
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-700 dark:text-white/70">
                <span className="mt-1 text-rose-600 dark:text-red-400">✗</span>
                <span>
                  We <strong className="text-slate-900 dark:text-white/90">never access</strong> calendar data beyond
                  what&apos;s needed for scheduling
                </span>
              </li>
            </ul>
          </div>

          {/* Privacy Link */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row">
            <p className="text-center text-sm text-slate-600 dark:text-white/50 sm:text-start">
              For complete details on how we handle your data, please review our privacy policy.
            </p>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <Shield className="h-4 w-4 shrink-0" />
              Read Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
