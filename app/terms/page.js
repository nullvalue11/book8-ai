"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-sm z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">B8</span>
            </div>
            <span className="text-white font-semibold">Book8 AI</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="prose prose-invert prose-zinc max-w-none">
          <h1 className="text-4xl font-bold text-white mb-2">Terms and Conditions</h1>
          <p className="text-zinc-400 text-sm mb-8">Last Updated: March 17, 2026</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
            <p className="text-zinc-300">
              By accessing or using Book8 AI (&quot;Service&quot;), operated by 11111221 Canada INC. (&quot;Book8 AI,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="text-zinc-300">
              Book8 AI is an AI-powered voice booking and scheduling platform. Businesses subscribe to receive an AI phone agent that handles appointment bookings, sends SMS and email confirmations, and manages appointment reminders on their behalf.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. Account Registration</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old to use the Service.</li>
              <li>One person or business entity per account unless otherwise agreed.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Subscription and Billing</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Subscription plans are billed monthly via Stripe.</li>
              <li>Prices are listed on our pricing page and may change with 30 days notice.</li>
              <li>All fees are in US dollars unless otherwise stated.</li>
              <li>You authorize us to charge your payment method on a recurring basis.</li>
              <li>Cancellations take effect at the end of the current billing period.</li>
              <li>No refunds are provided for partial months of service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. SMS and Voice Communications</h2>
            <p className="text-zinc-300">
              By using Book8 AI, you and your customers consent to receive communications as follows:
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.1 For Business Subscribers</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>You consent to receive account notifications, billing alerts, and service updates via email and SMS.</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.2 For End Customers (Callers)</h3>
            <p className="text-zinc-300">
              When a caller books an appointment through our AI agent and provides their phone number, they consent to receive:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Booking confirmation SMS</li>
              <li>Appointment reminder SMS (24 hours, 1 hour, and 30 minutes before)</li>
              <li>Cancellation confirmation SMS</li>
              <li>Message frequency varies based on booking activity.</li>
              <li>Message and data rates may apply.</li>
              <li>To cancel appointment reminders, reply <strong className="text-white">CANCEL BOOKING</strong> to any reminder.</li>
              <li>To stop all messages, reply <strong className="text-white">STOP</strong> at any time.</li>
              <li>For help, reply <strong className="text-white">HELP</strong> or contact support@book8.io.</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">5.3 Voice Calls</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Inbound calls to Book8 AI phone numbers are handled by an AI voice agent.</li>
              <li>Calls may be recorded and transcribed for quality assurance and booking accuracy.</li>
              <li>Call recordings are retained for up to 90 days.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Acceptable Use</h2>
            <p className="text-zinc-300">You agree NOT to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Send spam, unsolicited messages, or bulk communications through the Service.</li>
              <li>Impersonate any person or entity.</li>
              <li>Interfere with or disrupt the Service or servers.</li>
              <li>Attempt to gain unauthorized access to any part of the Service.</li>
              <li>Use the Service to harass, abuse, or harm others.</li>
              <li>Resell or redistribute the Service without our written consent.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Intellectual Property</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>The Service, including its design, features, and content, is owned by Book8 AI and protected by intellectual property laws.</li>
              <li>You retain ownership of your business data and customer information.</li>
              <li>You grant us a limited license to use your data solely to provide the Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Data and Privacy</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>
                Our collection and use of personal information is governed by our Privacy Policy at{" "}
                <a href="https://www.book8.io/privacy" className="text-brand-400 hover:text-brand-300" target="_blank" rel="noopener noreferrer">
                  https://www.book8.io/privacy
                </a>.
              </li>
              <li>You are responsible for ensuring your use of the Service complies with applicable data protection laws.</li>
              <li>You must obtain appropriate consent from your customers before their data is processed through the Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. Service Availability</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>We strive for high availability but do not guarantee uninterrupted service.</li>
              <li>We may perform maintenance that temporarily affects availability.</li>
              <li>We are not liable for any downtime or service interruptions.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Limitation of Liability</h2>
            <p className="text-zinc-300 font-semibold uppercase text-xs mb-2">To the maximum extent permitted by law:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind.</li>
              <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages.</li>
              <li>Our total liability is limited to the amount you paid us in the 12 months preceding the claim.</li>
              <li>We are not responsible for missed appointments, booking errors, or business losses resulting from use of the Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">11. Indemnification</h2>
            <p className="text-zinc-300">
              You agree to indemnify and hold harmless Book8 AI, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">12. Termination</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>You may cancel your subscription at any time through your dashboard.</li>
              <li>We may suspend or terminate your access for violation of these Terms.</li>
              <li>Upon termination, your right to use the Service ceases immediately.</li>
              <li>We may retain your data for up to 30 days after termination unless you request deletion.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">13. Modifications to Terms</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>We may update these Terms at any time.</li>
              <li>Material changes will be communicated via email or in-app notification.</li>
              <li>Continued use after changes constitutes acceptance of the updated Terms.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">14. Governing Law</h2>
            <p className="text-zinc-300">
              These Terms are governed by the laws of the Province of Ontario, Canada, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Ottawa, Ontario, Canada.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">15. Contact Us</h2>
            <p className="text-zinc-300">
              If you have questions about these Terms, contact us:
            </p>
            <p className="text-zinc-300">
              <strong className="text-white">Book8 AI Inc.</strong><br />
              Email: <a href="mailto:support@book8.io" className="text-brand-400 hover:text-brand-300">support@book8.io</a><br />
              Mailing Address:<br />
              Book8 AI<br />
              Ottawa, Ontario<br />
              Canada
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

