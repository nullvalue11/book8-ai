/** Copy for /migrate-from-newo — Newo → Book8 migration landing */

export const migrateFromNewoCopy = {
  meta: {
    title: 'Migrate from Newo to Book8 — Free Setup + 30 Days Growth | Book8',
    description:
      'Switch from Newo.ai to Book8: we port your business profile, services, calendar, and phone routing free. 30 days on Book8 Growth at no charge. ~30 minutes for a single location.',
    canonical: '/migrate-from-newo'
  },
  hero: {
    headline: 'Migrate from Newo to Book8',
    subheadline:
      'We move your business profile, services, booking calendar, and call routing for free — and give you 30 days on Book8 Growth at no charge while you validate the switch.'
  },
  offerBullets: [
    'Free white-glove migration (single-location ~30 minutes)',
    '30 days on Book8 Growth ($69/mo plan) at no charge',
    'Keep your existing phone number via forwarding',
    'Dedicated founder support during cutover'
  ],
  includedTitle: 'What we migrate for you',
  included: [
    { title: 'Business profile', body: 'Name, address, hours, and public booking page handle.' },
    { title: 'Services & pricing', body: 'Your service list, durations, and prices as configured in Book8.' },
    { title: 'Calendar connection', body: 'Google Calendar (or supported calendar) for live availability.' },
    { title: 'Phone routing', body: 'Forward your existing number to Book8’s AI receptionist on Twilio.' },
    { title: 'WhatsApp (if applicable)', body: 'Infobip WABA setup for MENA / WhatsApp-first markets.' }
  ],
  stepsTitle: 'How migration works',
  steps: [
    {
      title: 'Email us your Newo context',
      body: 'Send your business name, locations, and Newo account email to wais@book8.io. We reply within one business day with a short intake form.'
    },
    {
      title: '30-minute setup call (optional)',
      body: 'We walk through services, hours, and forwarding on a quick call — or async if you prefer.'
    },
    {
      title: 'Parallel run (recommended)',
      body: 'Run Book8 alongside Newo for a few days. Test calls and WhatsApp before you cut over fully.'
    },
    {
      title: 'Flip forwarding',
      body: 'Point your main business line to Book8. Cancel Newo when you are satisfied.'
    }
  ],
  faq: [
    {
      question: 'How long does migration take?',
      answer:
        'About 30 minutes of active work for a single-location business once we have your service list and hours. Multi-location migrations take longer — we scope those on the intake call.'
    },
    {
      question: 'Do I keep my phone number?',
      answer:
        'Yes. You keep your published business number. We route calls to Book8 through standard carrier forwarding to a Book8-provisioned Twilio number.'
    },
    {
      question: 'Is there an automated Newo import?',
      answer:
        'Not yet. Migration is hands-on with founder support so nothing is lost in translation. Automated import is on the roadmap if demand warrants it.'
    },
    {
      question: 'What about my Newo contract?',
      answer:
        'You manage your Newo subscription separately. We recommend parallel running until Book8 is proven, then cancel Newo on your billing cycle.'
    },
    {
      question: 'Why switch from Newo to Book8?',
      answer:
        'Book8 Growth is $69/mo vs Newo Starter at $99/mo for comparable AI voice reception, with $0.10 CAD/min voice metering vs Newo per-unit overages. Book8 is WhatsApp-native for MENA, India, LATAM, and Southeast Asia. See our full comparison on /newo-alternative.'
    },
    {
      question: 'Do you support dental or HIPAA workloads?',
      answer:
        'Not currently. If you require HIPAA today, stay on Newo for medical/dental. Book8 focuses on salons, barbers, car washes, fitness, spas, and similar service businesses.'
    }
  ],
  ctaEmail: 'wais@book8.io',
  setupHref: '/setup?newBusiness=1&source=migrate-from-newo'
}
