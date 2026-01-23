"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm mb-8">Last Updated: January 23, 2025</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <p className="text-zinc-300 m-0">
              Book8 AI Inc. (&quot;Book8 AI,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
              AI-powered booking and scheduling platform.
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mt-0 mb-4">Table of Contents</h2>
            <ol className="list-decimal list-inside space-y-2 text-zinc-400 m-0">
              <li><a href="#company-info" className="text-brand-400 hover:text-brand-300">Company Information</a></li>
              <li><a href="#information-collected" className="text-brand-400 hover:text-brand-300">Information We Collect</a></li>
              <li><a href="#how-we-use" className="text-brand-400 hover:text-brand-300">How We Use Your Information</a></li>
              <li><a href="#data-sharing" className="text-brand-400 hover:text-brand-300">Data Sharing and Third-Party Services</a></li>
              <li><a href="#cookies" className="text-brand-400 hover:text-brand-300">Cookies and Tracking Technologies</a></li>
              <li><a href="#data-retention" className="text-brand-400 hover:text-brand-300">Data Retention</a></li>
              <li><a href="#data-security" className="text-brand-400 hover:text-brand-300">Data Security</a></li>
              <li><a href="#international-transfers" className="text-brand-400 hover:text-brand-300">International Data Transfers</a></li>
              <li><a href="#your-rights" className="text-brand-400 hover:text-brand-300">Your Rights and Choices</a></li>
              <li><a href="#gdpr" className="text-brand-400 hover:text-brand-300">GDPR Compliance (European Users)</a></li>
              <li><a href="#ccpa" className="text-brand-400 hover:text-brand-300">CCPA Compliance (California Residents)</a></li>
              <li><a href="#pipeda" className="text-brand-400 hover:text-brand-300">PIPEDA Compliance (Canadian Users)</a></li>
              <li><a href="#children" className="text-brand-400 hover:text-brand-300">Children&apos;s Privacy</a></li>
              <li><a href="#changes" className="text-brand-400 hover:text-brand-300">Changes to This Policy</a></li>
              <li><a href="#contact" className="text-brand-400 hover:text-brand-300">Contact Us</a></li>
            </ol>
          </div>

          {/* Section 1 */}
          <section id="company-info" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">1. Company Information</h2>
            <p className="text-zinc-300">
              Book8 AI Inc. is a company incorporated in Canada, with its principal place of business in Ottawa, Ontario, Canada. 
              Our services are accessible globally to users worldwide.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mt-4">
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Data Controller:</strong><br />
                Book8 AI Inc.<br />
                Ottawa, Ontario, Canada<br />
                Email: privacy@book8.io
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="information-collected" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.1 Information You Provide Directly</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Account Information:</strong> Name, email address, password (encrypted), profile picture</li>
              <li><strong className="text-white">Business Information:</strong> Business name, description, booking preferences, availability settings</li>
              <li><strong className="text-white">Booking Data:</strong> Appointment details, customer names, contact information, notes, and scheduling preferences</li>
              <li><strong className="text-white">Payment Information:</strong> Billing address and payment method details (processed securely by Stripe)</li>
              <li><strong className="text-white">Communications:</strong> Messages, support requests, and feedback you send to us</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.2 Information Collected Through Third-Party Integrations</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Google Calendar:</strong> Calendar events, availability, and scheduling data when you connect your Google account</li>
              <li><strong className="text-white">Microsoft Outlook:</strong> Calendar events and scheduling data when you connect your Microsoft account</li>
              <li><strong className="text-white">OAuth Authentication:</strong> Basic profile information (name, email, profile picture) when you sign in with Google or Microsoft</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.3 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Device Information:</strong> Browser type, operating system, device identifiers</li>
              <li><strong className="text-white">Usage Data:</strong> Pages visited, features used, time spent on the platform</li>
              <li><strong className="text-white">Log Data:</strong> IP address, access times, referring URLs</li>
              <li><strong className="text-white">Location Data:</strong> General geographic location based on IP address (not precise location)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">2.4 Voice AI Features</h3>
            <p className="text-zinc-300">
              When you use our Voice AI features for phone bookings:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Voice recordings may be processed to understand booking requests</li>
              <li>Transcriptions are generated for booking confirmation</li>
              <li>Call metadata (duration, timestamp) is collected</li>
              <li>Voice data is processed in accordance with applicable laws and is not sold to third parties</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="how-we-use" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-300 mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Provide, maintain, and improve our booking and scheduling services</li>
              <li>Process and manage bookings and appointments</li>
              <li>Sync your calendar across connected platforms</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send booking confirmations, reminders, and service notifications</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
              <li>Send marketing communications (with your consent)</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="data-sharing" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Sharing and Third-Party Services</h2>
            <p className="text-zinc-300 mb-4">
              We share your information with the following categories of third parties:
            </p>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">4.1 Payment Processing</h3>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Stripe, Inc.</strong><br />
                We use Stripe to process payments. When you make a payment, your payment information is sent directly to Stripe. 
                We do not store your complete credit card information on our servers. Stripe&apos;s privacy policy is available at{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                  stripe.com/privacy
                </a>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">4.2 Calendar Integrations</h3>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Google Calendar (Google LLC)</strong><br />
                When you connect Google Calendar, we access your calendar data to sync bookings. Google&apos;s privacy policy is available at{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                  policies.google.com/privacy
                </a>
              </p>
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Microsoft Outlook (Microsoft Corporation)</strong><br />
                When you connect Microsoft Outlook, we access your calendar data to sync bookings. Microsoft&apos;s privacy policy is available at{" "}
                <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                  privacy.microsoft.com/privacystatement
                </a>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">4.3 Voice and Communication Services</h3>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Twilio Inc.</strong><br />
                We may use Twilio for voice AI and SMS notifications. Twilio&apos;s privacy policy is available at{" "}
                <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                  twilio.com/legal/privacy
                </a>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">4.4 Other Disclosures</h3>
            <p className="text-zinc-300">We may also share your information:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>With service providers who assist in operating our platform (hosting, analytics, support)</li>
              <li>To comply with legal obligations, court orders, or government requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
              <li>With your consent or at your direction</li>
            </ul>

            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-4">
              <p className="text-green-400 m-0 font-semibold">
                ✓ We do not sell your personal information to third parties.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="cookies" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">5. Cookies and Tracking Technologies</h2>
            <p className="text-zinc-300 mb-4">We use cookies and similar technologies to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Keep you signed in to your account</li>
              <li>Remember your preferences and settings</li>
              <li>Understand how you use our platform</li>
              <li>Improve our services based on usage patterns</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">Types of Cookies We Use</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-zinc-300 border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white">Cookie Type</th>
                    <th className="text-left py-3 px-4 text-white">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="py-3 px-4">Essential</td>
                    <td className="py-3 px-4">Required for the platform to function (authentication, security)</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="py-3 px-4">Functional</td>
                    <td className="py-3 px-4">Remember your preferences and settings</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="py-3 px-4">Analytics</td>
                    <td className="py-3 px-4">Help us understand how you use our platform</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-zinc-300 mt-4">
              You can control cookies through your browser settings. However, disabling cookies may affect the functionality of our platform.
            </p>
          </section>

          {/* Section 6 */}
          <section id="data-retention" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p className="text-zinc-300 mb-4">
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy. Specifically:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Account Data:</strong> Retained while your account is active and for up to 30 days after deletion request</li>
              <li><strong className="text-white">Booking Data:</strong> Retained for 7 years for business and legal compliance purposes</li>
              <li><strong className="text-white">Payment Records:</strong> Retained as required by tax and financial regulations (typically 7 years)</li>
              <li><strong className="text-white">Voice Recordings:</strong> Retained for up to 90 days unless required for dispute resolution</li>
              <li><strong className="text-white">Log Data:</strong> Retained for up to 12 months</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section id="data-security" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
            <p className="text-zinc-300 mb-4">
              We implement appropriate technical and organizational measures to protect your personal information, including:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication mechanisms including OAuth 2.0</li>
              <li>Regular security assessments and monitoring</li>
              <li>Access controls and employee training</li>
              <li>Secure data centers with physical security measures</li>
            </ul>
            <p className="text-zinc-300 mt-4">
              While we strive to protect your information, no method of transmission over the internet is 100% secure. 
              We cannot guarantee absolute security.
            </p>
          </section>

          {/* Section 8 */}
          <section id="international-transfers" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">8. International Data Transfers</h2>
            <p className="text-zinc-300 mb-4">
              As a Canadian company serving users worldwide, your information may be transferred to and processed in countries other than your country of residence, including Canada and the United States.
            </p>
            <p className="text-zinc-300 mb-4">
              When we transfer data internationally, we ensure appropriate safeguards are in place:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Standard Contractual Clauses (SCCs) approved by relevant authorities</li>
              <li>Adequacy decisions where applicable</li>
              <li>Binding Corporate Rules for transfers within our organization</li>
              <li>Your explicit consent where required</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="your-rights" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">9. Your Rights and Choices</h2>
            <p className="text-zinc-300 mb-4">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong className="text-white">Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong className="text-white">Deletion:</strong> Request deletion of your personal information</li>
              <li><strong className="text-white">Portability:</strong> Request a copy of your data in a machine-readable format</li>
              <li><strong className="text-white">Restriction:</strong> Request restriction of processing of your data</li>
              <li><strong className="text-white">Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong className="text-white">Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p className="text-zinc-300 mt-4">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@book8.io" className="text-brand-400 hover:text-brand-300">privacy@book8.io</a>.
              We will respond to your request within 30 days.
            </p>
          </section>

          {/* Section 10 */}
          <section id="gdpr" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">10. GDPR Compliance (European Users)</h2>
            <p className="text-zinc-300 mb-4">
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Legal Basis:</strong> We process your data based on: contract performance, legitimate interests, consent, or legal obligations</li>
              <li><strong className="text-white">Data Protection Officer:</strong> Contact our DPO at dpo@book8.io</li>
              <li><strong className="text-white">Supervisory Authority:</strong> You have the right to lodge a complaint with your local data protection authority</li>
              <li><strong className="text-white">Automated Decision-Making:</strong> We do not make solely automated decisions that significantly affect you</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section id="ccpa" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">11. CCPA Compliance (California Residents)</h2>
            <p className="text-zinc-300 mb-4">
              If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Right to Know:</strong> What personal information we collect, use, disclose, and sell</li>
              <li><strong className="text-white">Right to Delete:</strong> Request deletion of your personal information</li>
              <li><strong className="text-white">Right to Opt-Out:</strong> Opt-out of the sale of personal information (we do not sell personal information)</li>
              <li><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your rights</li>
            </ul>
            <p className="text-zinc-300 mt-4">
              To exercise your CCPA rights, contact us at{" "}
              <a href="mailto:privacy@book8.io" className="text-brand-400 hover:text-brand-300">privacy@book8.io</a>{" "}
              or call us at the number provided in the Contact section.
            </p>
          </section>

          {/* Section 12 */}
          <section id="pipeda" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">12. PIPEDA Compliance (Canadian Users)</h2>
            <p className="text-zinc-300 mb-4">
              As a Canadian company, we comply with the Personal Information Protection and Electronic Documents Act (PIPEDA):
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li><strong className="text-white">Accountability:</strong> We are responsible for personal information under our control</li>
              <li><strong className="text-white">Consent:</strong> We obtain meaningful consent for the collection, use, and disclosure of personal information</li>
              <li><strong className="text-white">Limiting Collection:</strong> We collect only information necessary for identified purposes</li>
              <li><strong className="text-white">Accuracy:</strong> We keep personal information accurate, complete, and up-to-date</li>
              <li><strong className="text-white">Access:</strong> You can request access to your personal information held by us</li>
            </ul>
            <p className="text-zinc-300 mt-4">
              You may file a complaint with the Office of the Privacy Commissioner of Canada at{" "}
              <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                priv.gc.ca
              </a>
            </p>
          </section>

          {/* Section 13 */}
          <section id="children" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">13. Children&apos;s Privacy</h2>
            <p className="text-zinc-300">
              Our services are not intended for children under 16 years of age. We do not knowingly collect personal information from children under 16. 
              If we learn that we have collected personal information from a child under 16, we will take steps to delete that information as quickly as possible. 
              If you believe we have collected information from a child under 16, please contact us at{" "}
              <a href="mailto:privacy@book8.io" className="text-brand-400 hover:text-brand-300">privacy@book8.io</a>.
            </p>
          </section>

          {/* Section 14 */}
          <section id="changes" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">14. Changes to This Policy</h2>
            <p className="text-zinc-300">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mt-4">
              <li>Posting the updated policy on this page with a new &quot;Last Updated&quot; date</li>
              <li>Sending you an email notification (for significant changes)</li>
              <li>Displaying a notice within our platform</li>
            </ul>
            <p className="text-zinc-300 mt-4">
              We encourage you to review this policy periodically. Your continued use of our services after changes are posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          {/* Section 15 */}
          <section id="contact" className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">15. Contact Us</h2>
            <p className="text-zinc-300 mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <p className="text-zinc-300 m-0">
                <strong className="text-white">Book8 AI Inc.</strong><br /><br />
                <strong className="text-white">Email:</strong>{" "}
                <a href="mailto:privacy@book8.io" className="text-brand-400 hover:text-brand-300">privacy@book8.io</a><br /><br />
                <strong className="text-white">Data Protection Officer:</strong>{" "}
                <a href="mailto:dpo@book8.io" className="text-brand-400 hover:text-brand-300">dpo@book8.io</a><br /><br />
                <strong className="text-white">Mailing Address:</strong><br />
                Book8 AI Inc.<br />
                Ottawa, Ontario<br />
                Canada<br /><br />
                <strong className="text-white">Response Time:</strong> We aim to respond to all inquiries within 30 days.
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-zinc-500 text-sm text-center">
              © 2025 Book8 AI Inc. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
