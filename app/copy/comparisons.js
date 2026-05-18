/** Comparison landing pages — BOO-NEWO-ALT-1B and future competitors */

export const newoAlternativeCopy = {
  slug: 'newo-alternative',
  meta: {
    title: 'Book8 vs Newo: The Best Newo.ai Alternative for Service Businesses (2026)',
    description:
      'Looking for a Newo alternative? Book8 starts at $19/mo (vs $99 for Newo), with WhatsApp-native MENA support and 70+ languages. Free 14-day trial. No credit card.',
    canonical: '/newo-alternative'
  },
  hero: {
    headline: 'Looking for a Newo Alternative? Meet Book8.',
    subheadline:
      'Newo.ai is a strong AI receptionist for SMBs. So is Book8 — at $19/month instead of $99, with WhatsApp-native MENA support, 70+ languages, and dedicated pages for beauty, wellness, and service businesses.',
    primaryCtaLabel: 'Start free 14-day trial',
    primaryCtaHint: 'No credit card to start.'
  },
  setupHref: '/setup?newBusiness=1&source=newo-alternative',
  comparisonSectionTitle: 'Book8 vs Newo at a glance',
  comparisonTable: {
    headers: ['', 'Book8', 'Newo'],
    rows: [
      { label: 'Starting price', book8: '$19 USD/month', newo: '$99/month' },
      { label: 'Top tier', book8: '$199 USD/month', newo: '$499/month' },
      { label: 'Free trial', book8: '14 days', newo: '2 months' },
      { label: 'Languages', book8: '70+ (auto-detection)', newo: '60 (auto-detection)' },
      { label: 'WhatsApp native', book8: 'Yes (Infobip integration)', newo: 'Limited' },
      { label: 'MENA / UAE support', book8: 'Yes (WhatsApp routing)', newo: 'Limited' },
      {
        label: 'Beauty / wellness focus',
        book8: 'Yes — 10 dedicated vertical pages',
        newo: 'Dental-focused'
      },
      { label: 'Per-overage cost', book8: '$0.075/min', newo: '$1.00–$1.65/call' },
      { label: 'Founded', book8: '2025', newo: '2023' },
      { label: 'Customers', book8: 'Pre-revenue (beta)', newo: '1,000+' },
      { label: 'Funding', book8: 'Bootstrapped', newo: '$25M Series A' }
    ]
  },
  reasonsSectionTitle: 'Three reasons Book8 might be the better fit',
  reasons: [
    {
      title: 'Lower entry price for small operators',
      body: `Book8 starts at $19/month. Newo starts at $99/month. For a solo barber, single-location car wash, or two-chair salon, that's a 5x cost difference for very similar core functionality.

If you're a one-shop service business, the ROI math on $19/month is much easier to defend than $99/month — especially in your first 6 months when you're still proving the value to yourself.`
    },
    {
      title: 'MENA & WhatsApp-native from day one',
      body: `If you operate (or want to expand into) the UAE, Saudi Arabia, Egypt, Jordan, or India, WhatsApp matters more than voice calls. UAE actually blocks VoIP at the network level (TDRA regulation), so phone-based AI doesn't work there.

Book8 routes through Infobip's WhatsApp Business API for MENA messaging while using Twilio for North American and European voice. Newo is voice-primary and US/Europe focused — it works fine domestically, but it wasn't built for the WhatsApp-first markets.`
    },
    {
      title: 'Beauty, wellness, and service vertical depth',
      body: `Newo's vertical content focuses on dental (newo.ai/dental-ai-receptionist) and cleaning. Strong choice for that segment.

Book8 has 10 dedicated vertical pages: barbershops, hair salons, nail salons, spas, fitness studios, car washes, auto repair, pet grooming, cleaning services, and tattoo studios. If you're in one of those verticals, you'll find pain points, FAQ, and copy specifically about your business — not generic "AI receptionist for SMBs" copy.`
    }
  ],
  whenCompetitorSectionTitle: 'When Newo is probably the better choice',
  whenCompetitorIntro: `This page wouldn't be honest without saying it: Newo isn't worse — it's positioned differently. Pick Newo if:`,
  whenCompetitorBullets: [
    "You run a dental clinic. Newo has a polished dental-specific product (/dental-ai-receptionist). Book8 doesn't currently take dental customers — it requires HIPAA BAAs with our telephony and AI providers, which we haven't signed yet.",
    "You want a longer free trial before committing. Newo offers 2 months free. Book8 offers 14 days. If you need more time to evaluate, that's a real advantage.",
    "You want a vendor with 1,000+ customers and Series A backing. Book8 is pre-revenue and bootstrapped. If you need vendor stability as a procurement requirement, Newo's $25M and customer base are real.",
    "Your business is exclusively in the US / Western Europe and voice-only. Newo's voice product is mature and proven. Book8's voice product works well too — but if you don't care about WhatsApp or multilingual support beyond Spanish, Newo's maturity may matter more than Book8's wedges."
  ],
  faq: [
    {
      question: 'Is Book8 cheaper than Newo?',
      answer:
        "Yes. Book8 starts at $19/month USD. Newo's lowest tier is $99/month. For comparable functionality at single-location businesses, Book8 is roughly 5x cheaper to start."
    },
    {
      question: 'Can I migrate from Newo to Book8?',
      answer:
        "There's no automated migration tool. Setup takes about 3 minutes: add your services, hours, and phone number, and Book8 is live. If you're forwarding from a Newo-routed number, switch the forwarding to Book8's number."
    },
    {
      question: 'Does Book8 work in the UAE or other Middle Eastern countries?',
      answer:
        'Yes. Book8 uses WhatsApp via Infobip for MENA markets where VoIP is blocked or limited (UAE blocks VoIP at the network layer). For Saudi Arabia, Egypt, Jordan, and similar markets, WhatsApp messaging works fine. Newo is primarily voice-focused for North America and Europe.'
    },
    {
      question: 'How many languages does each platform support?',
      answer:
        "Book8 supports 70+ languages with automatic detection. Newo states 60 languages. Both auto-detect the caller's language and respond accordingly. For multilingual neighborhoods in North America (LA, Miami, Brooklyn, Toronto) or globally, both products work — Book8 has slightly broader coverage."
    },
    {
      question: 'Does Book8 have dental support?',
      answer:
        "Not yet. Dental requires HIPAA Business Associate Agreements (BAAs) with our telephony provider (Twilio), AI provider (ElevenLabs), database provider (MongoDB Atlas), and hosting providers. We haven't completed those agreements yet. If you're a dental practice today, Newo's /dental-ai-receptionist is the right choice. We expect to launch dental support in 2026."
    },
    {
      question: 'Which is faster to set up?',
      answer:
        "Book8 advertises 3-minute setup: add services, hours, phone number forwarding, done. Newo's onboarding includes a dedicated telephony specialist who configures your existing number — which is more support but takes longer to go live. If you want hands-on guidance, Newo. If you want to ship in 3 minutes, Book8."
    },
    {
      question: 'What about contracts?',
      answer:
        "Book8 is month-to-month with cancel-anytime through your dashboard. Newo's terms vary by tier. Always check the latest terms on their pricing page."
    }
  ],
  finalCta: {
    headline: 'Ready to try Book8?',
    body: '14 days free. No credit card to start. 3-minute setup. Multilingual out of the box.',
    primaryCtaLabel: 'Start your free trial',
    secondaryLabel: 'Compare plans and pricing',
    secondaryHref: '/pricing?currency=USD'
  },
  breadcrumbLabel: 'Book8 vs Newo'
}
