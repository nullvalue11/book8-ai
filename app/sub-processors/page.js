import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Sub-Processors — Book8",
  description:
    "List of third-party sub-processors used by Book8 AI to deliver our services.",
  alternates: {
    canonical: "/sub-processors",
  },
};

const SUB_PROCESSORS = [
  {
    name: "Stripe",
    purpose: "Payment processing & subscription billing",
    data: "Customer payment details, billing address, email",
    location: "USA (with EU operations)",
  },
  {
    name: "Twilio",
    purpose: "Phone number provisioning, voice calls, SMS notifications",
    data: "Phone numbers, call audio, SMS message content",
    location: "USA (with EU presence)",
  },
  {
    name: "ElevenLabs",
    purpose: "AI voice synthesis & conversational AI",
    data: "Call audio, transcripts, business context",
    location: "USA",
  },
  {
    name: "Google (Gemini)",
    purpose: "LLM for conversational AI",
    data: "Call transcripts during processing (not retained)",
    location: "USA / EU",
  },
  {
    name: "MongoDB Atlas",
    purpose: "Primary database (business data, bookings, users)",
    data: "Business profiles, booking records, user accounts",
    location: "USA (multi-region)",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery",
    data: "Recipient email addresses, message content",
    location: "USA",
  },
  {
    name: "Vercel",
    purpose: "Application hosting (book8-ai dashboard)",
    data: "Application logs, request metadata",
    location: "USA (Edge network global)",
  },
  {
    name: "Render",
    purpose: "Application hosting (book8-core-api)",
    data: "Application logs, request metadata",
    location: "USA",
  },
  {
    name: "Cloudinary",
    purpose: "Image hosting (business logos, photos)",
    data: "Uploaded image files",
    location: "USA",
  },
  {
    name: "AWS Route 53",
    purpose: "DNS provider for book8.io",
    data: "DNS query logs",
    location: "USA",
  },
  {
    name: "Google OAuth",
    purpose: "Calendar integration sign-in",
    data: "OAuth tokens, calendar metadata",
    location: "USA / EU",
  },
  {
    name: "Microsoft Azure AD",
    purpose: "Outlook calendar integration sign-in",
    data: "OAuth tokens, calendar metadata",
    location: "USA / EU",
  },
];

export default function SubProcessorsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="border-b border-white/10 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-sm z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">B8</span>
            </div>
            <span className="text-white font-semibold">Book8</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="prose prose-invert prose-zinc max-w-none">
          <h1 className="text-4xl font-bold text-white mb-2">Sub-Processors</h1>
          <p className="text-zinc-400 text-sm mb-8">Last Updated: May 2, 2026</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <p className="text-zinc-300 m-0">
              Book8 AI uses the following third-party sub-processors to deliver
              our services. We are committed to transparency about who handles
              your data.
            </p>
          </div>

          {/* Desktop / tablet table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-zinc-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="py-3 px-4 text-white text-sm font-semibold">Name</th>
                  <th className="py-3 px-4 text-white text-sm font-semibold">Purpose</th>
                  <th className="py-3 px-4 text-white text-sm font-semibold">Data Processed</th>
                  <th className="py-3 px-4 text-white text-sm font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                {SUB_PROCESSORS.map((sp) => (
                  <tr key={sp.name} className="border-b border-white/10 last:border-b-0 align-top">
                    <td className="py-3 px-4 text-white font-medium whitespace-nowrap">{sp.name}</td>
                    <td className="py-3 px-4 text-sm">{sp.purpose}</td>
                    <td className="py-3 px-4 text-sm">{sp.data}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked card layout */}
          <div className="md:hidden space-y-4">
            {SUB_PROCESSORS.map((sp) => (
              <div
                key={sp.name}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-white font-semibold m-0 mb-2">{sp.name}</p>
                <dl className="space-y-2 text-sm m-0">
                  <div>
                    <dt className="text-zinc-500 text-xs uppercase tracking-wide">Purpose</dt>
                    <dd className="text-zinc-300 m-0">{sp.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 text-xs uppercase tracking-wide">Data Processed</dt>
                    <dd className="text-zinc-300 m-0">{sp.data}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 text-xs uppercase tracking-wide">Location</dt>
                    <dd className="text-zinc-300 m-0">{sp.location}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
            <p className="text-zinc-300 m-0">
              We notify customers via email at least 30 days before adding a new
              sub-processor that processes personal data. To object to a new
              sub-processor, contact{" "}
              <a
                href="mailto:privacy@book8.io"
                className="text-brand-400 hover:text-brand-300"
              >
                privacy@book8.io
              </a>
              .
            </p>
          </div>

          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-zinc-500 text-sm text-center">
              © {new Date().getFullYear()} Book8. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
