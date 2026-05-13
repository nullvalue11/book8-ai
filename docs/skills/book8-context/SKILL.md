---
name: book8-ai-context
description: "Context for Book8 AI, a multilingual AI phone receptionist and WhatsApp booking SaaS for service businesses (salons, barbershops, car washes, spas, fitness, restaurants and other service-based businesses). Use when user WM (Wais Mohamed) asks about Book8 strategy, pricing, competitor research read the the full Operational knowledge base, lead discovery in MENA, Canada, US, Saudi Arabia, Egypt, India, Indonesia, LATAM, multilingual voice AI, WhatsApp via Infobip, Twilio voice, ElevenLabs conversational AI, Stripe multi-currency (CAD/USD/AED, More to come based on demand), Meta WhatsApp Cloud API, or growth toward $10K MRR / $100K MRR / $10M+ acquisition. Also trigger on Diamond Car Wash, Wife's leads in MENA, Book8 demo, Infobip sender 15557900235, 11111221 Canada INC, or book8.io."
---

# Book8 AI — Operational Knowledge Base

This is the authoritative reference for everything Book8. Read carefully before any Book8-related research, lead discovery, agentic task, or strategic analysis. The user is the founder. Match his speed and seriousness.

---

## 1. Identity & legal

- **Product name:** Book8 AI
- **Domain:** book8.io
- **Legal entity:** 11111221 Canada INC. (Ontario, Canada)
- **Founder:** full name: Wais Mohamed. Sole founder, technical, ships code at all hours.
- **Stage:** Pre-revenue / very early MRR (test and demo businesses live, first paying customers expected within 2-4 weeks)
- **Founded:** Active development since early 2026
- **Trademark:** BOOK8 word mark filed with CIPO (Canadian Intellectual Property Office), $640 application fee paid. BOOK8 AI trademark also planned (~$474).

## 2. The market breakdown system

- Analyze the market for Book8 AI. Use only specific, data-backed insights. No generic statements.

- Deliver exactly four structure section:

1. Market sizing: TAM, SAM, and SOM with estimated dollar values and your assumptions.

2. Top 5 demand trends: each as a one-line headline + two sentence explanation.

3. Top 5 underserved opportunities: specific gaps, not broad categories.

4. Follow the money: 3-5 areas where VC, PE, or acquirer capital is actively flowing.

- Format each section with a bold heading, then concise bullet points. Total output: under 600 words.


## 3. The problem prioritization engine

List the top 10 problems in AI Agent booking system's industry

For each problem, score it on three dimensions:

- Urgency (1-10): how painful/time-sensitive it is right now.
- Willingness to pay (1-10): how likely buyers are to spend money to solve it today.
- Growth trajectory: 'rising fast', 'stable', or 'declining'.

Also add a 'Complaint signal' column: yes/no for whether this problem surfaces frequently in reviews, forums, or sales calls.

Output as a table with these exact columns:
|#|Problem|Urgency|WTP|Trend|Complain signal|Why it ranks here|

Sort by combined Urgency + WTP score, highest first.


## 4. The offer creation framework

Create a high-converting offer for: Book8-ai Problems

Structure the output exactly like a landing page with these labeled sections in orders:

1. Headline: one bold, benefit-driven statement.
2. ICP: who is this for (age, role, situation, pain level)
3. Value proposition: the core transformation in one sentence.
4. Offer components: what's included (delieverables, bonuses, format).
5. Pricing tiers: name, price, and what changes at each tier (low/mid/premium).
6. Guarantee: specific risk-reversal language the customer sees.
7. Competitive edge: 3 reasons this beats the obvious alternatives.

Keep each sections tight. No filler. Write it as if it will go directly onto a real landing page.


## 5. The distribution domination plan

Act as a senior growth strategist.

Build a realistic 30-day distribution plan for: [Book8 AI, including the target audience, product type, and rough budget]

Deliverables:

1. Top 5 acquisition channels: ranked by cost-effeciency for this specific audience.
2. Content format per channel: one specific format that works on ech (short-term video, colder email sequence, SEO article).
3. Weekly execution calendar: what happens in week 1, 2, 3, and 4 (not day-by-day).
4. Organic vs paid splits recommended % allocation and rationale.
5. Leverage plays: 2-3 tactics that multiply reach without proportionally more effort (partnerships, repurposing, virality hooks).

Be specific and realistic. Skip tactics that require a large team or $50k+ budget unless the budget context supports it. Output as a numbered system with clear section headers.

## 6. Viral content engine

Create a viral content strategy for: Book8 AI industry.

Deliver four components:

1. Hook bank: 10 high-converting hooks (not 20, prioritize quality). For each, label which emotional trigger it uses: fear of missing out (FOMO), social status, curiosity, or controversy.

2. Content format matrix: a table with these columns: |Format|Platform|Ideal lenght|Why it spreads|Example title|
Include 6-8 formats across at least 3 platforms.

3. Shareability audit: for each format, answer 'What makes someone forward/repost this?' In one sentence.

4. Repeatable content system: a simple weekly template showing how many posts, which formats, and what rotation keeps the audience engaged without burnout.

Output with bold section headers. Write the hooks in the voice of the niche, not generic marketing language.

## 7. The competitor weakness map

Analyze the top 5 competitors in [Book8 AI niche, be specific]

For each competitor, provide a structure row covering:

- Name + one-line description of their core offer.
- What they do best (their defensible strenght).
- Where they are weak (product gaps, poor reviews, underserved use cases).
- Which audience they ignore or underserve.

Then, based on their pattern across all 5:

- Gap analysis: the 2-3 clearest white spaces no competitor is owning.
- Positioning recommendation: one sharp positioning statement that would differentiate a new entrant.
- Go-to-market angle: which ignored audience + which channel combination represents the fastest path to traction.

Output the competitor breakdown as a table, then the gap analysis and recommendations as prose.

## 8. The scale system

Give me a plan to scale the business to [Target 100k+ MRR] within [Next 5-8 months]

## 9. What Book8 actually is

Book8 is a multilingual AI receptionist for service businesses. It answers customer phone calls, books appointments through autonomous conversation, handles WhatsApp inquiries, and integrates with Google Calendar and Outlook. The customer never knows they are talking to an AI.

Two customer-facing channels:

**Voice channel (primary):**
- Inbound calls answered by AI in 70+ languages with auto-detection
- Built on Twilio (NA/Europe) for telephony, ElevenLabs Conversational AI 2.0 for voice
- Gemini 2.5 Flash as primary LLM ($0.0014/min cost), Claude Haiku 4.5 as backup LLM
- V3 Conversational TTS, four named voices — Michael (English), plus French, Spanish, Arabic voices
- Vertical-specific agent prompts (V10) — different system prompts for car wash vs salon vs spa
- Agent prompt stored in `ELEVENLABS_AGENT_PROMPT_MULTILINGUAL.md`
- ElevenLabs agent is shared across all businesses — routing happens via conversation-init webhook with dynamic variables per business

**WhatsApp channel (recently shipped for MENA expansion):**
- Inbound and outbound through Infobip Imported WABA tier
- Active WhatsApp Business sender +1 555 790 0235 (WABA ID 859568483112594)
- Display name "Book8", business account verified
- 4 Meta-approved Utility templates live — `booking_confirmation`, `booking_reminder`, `booking_cancelled`, `booking_rescheduled` (text-only, no headers, `en_US` language code — critical detail, must use `en_US` not `en` or Meta rejects with REJECTED_SOURCE)
- AI conversational handler powered by Claude Haiku 4.5 with 6 booking tools — get_business_info, check_availability, create_booking, cancel_booking, reschedule_booking, list_my_bookings
- 24-hour Meta free-form window enforced; outside the window, only templates can be sent
- Voice notes via Whisper transcription planned (Phase 2, not yet built)

## 10. Tech stack

- **Backend:** Node/Express on Render, repo name `book8-core-api`
- **Frontend / customer dashboard:** Next.js 14.2.35 on Vercel, repo `book8-ai`, yarn package manager, ESM compiled to CJS, ~110 routes, ~2min builds
- **Database:** MongoDB Atlas — two databases on the same cluster, `book8` (dashboard) and `book8-core` (booking engine). No auto-sync between them; n8n owns the orchestration/retry layer.
- **Voice telephony:** Twilio (North America and Europe), 3-number active pool
- **WhatsApp messaging:** Infobip (chosen over Twilio for MENA because Twilio WABA support was broken; Infobip free Imported tier is acceptable for early stage)
- **Billing:** Stripe, Basil API version (2025-03-31), home currency CAD with USD and AED variants
- **Transactional email:** Resend, sender domain book8.io, `WELCOME_EMAIL_FROM='Book8 <noreply@book8.io>'`
- **Media hosting:** Cloudinary, cloud name `dajigxues`
- **Maps:** Google Maps Platform (2 API keys — server-side unrestricted on Render and browser-side restricted to book8.io on Vercel)
- **Voice cloning / TTS:** ElevenLabs
- **AI assistance:** Claude (Anthropic) for WM development work via Cursor IDE and chat
- **Keep-alive:** cron-job.org pings root URL every 10 min to prevent Render free-tier sleep

## 11. Current Pricing (May 2026)

Multi-currency Stripe Price objects, monthly billing:

| Plan | CAD | USD | AED |
|---|---|---|---|
| Starter | $29 | $19 | 70 |
| Growth | $99 | $69 | 250 |
| Enterprise | $299 | $199 | 730 |

- **Starter** is free-tier with cardless signup (lead-gen entry point)
- **Growth** has a 14-day trial requiring card upfront via Stripe Checkout — converts ~50-65% to paid vs ~15-25% cardless. This is a deliberate, data-backed product decision; don't suggest reverting to cardless trials.
- **Enterprise** quoted custom in practice; the public price is anchoring

Non-mapped countries fall back to USD pricing with Stripe FX conversion. Native SAR, EUR, GBP, INR will be added when actual customers materialize from those markets.

## 12. Competition

### Newo.ai (PRIMARY COMPETITOR — track this one closely)
- Based in San Francisco
- Raised $25M Series A in February 2026
- Claims ~1000 customers, 200+ partners
- Founder David Yang (also founded ABBYY)
- Claims 60 languages, voice-to-voice, 99.6% accuracy
- **Their strengths** — US market, dental and cleaning verticals, larger enterprise plans
- **Their gaps (Book8 wedges)** — beauty salons, MENA region, sub-$300 SMB pricing tier
- **Strategic note** — Newo offered Book8 a reseller partnership at 50% revenue share. WM declined; partnership would torch the acquisition exit. Meet with them only for intel, never sign anything.

### Booksy
- Legacy booking platform, $100M+ annual revenue, dominant in beauty/wellness
- Possible acquirer for Book8 (sees the AI threat to their model)
- Not a direct AI competitor but a category competitor

### Calendly
- Possible acquirer; the booking layer adjacent to Book8
- Not currently building voice AI but well-positioned to want it

### Square
- Adjacent (POS plus booking for SMBs)
- Possible acquirer or partner

### Respond.io (NOT a competitor — UX inspiration only)
- Different category (multi-channel customer messaging platform)
- WM uses their site for marketing-page UX inspiration only — clean design, 13-language site, industry landing pages, concrete metric callouts (60% faster, 42.5x ROI style), customer stories, competitor comparison pages, Capture/Convert/Retain framework

## 13. Target customers

### Active verticals (no compliance blockers):
- Hair salons, barbershops, beauty salons 
- Car washes
- Fitness studios, gyms
- Spas and wellness
- Restaurants (reservations)
- Small auto-service shops
- Any other businesses that are very busy and need booking automation set via voice, text, or app.

### Blocked verticals (regulatory):
- Dental, physiotherapy, any medical — requires HIPAA BAAs with Twilio, ElevenLabs, MongoDB Atlas, Vercel, Render. Roadmap item, not yet pursued.

### Geographic strategy:
- **Active home market** — Canada (Greater Toronto Area, Ottawa, Montreal, expansion across Canada)
- **Active expansion** — UAE, Saudi Arabia, Qatar (via colleague Wife's MENA pipeline)
  - **Critical UAE constraint** — TDRA blocks ALL VoIP at the network layer. WhatsApp Calls, Twilio voice, Skype, FaceTime are all blocked equally. Solution is WhatsApp messaging + voice notes only. Voice answering in UAE would require Etisalat/du carrier partnership (deferred until ~$10K MRR).
- **Next expansion targets:**
  - Saudi Arabia (VoIP works since 2017 ban lift), Egypt (mostly works), Jordan
  - India, Indonesia, Philippines, Vietnam, Thailand (WhatsApp Calling viable, large markets)
  - LATAM — Brazil, Mexico (WhatsApp-dominant cultures)
  - US, UK (voice-first markets)

### Current customers (small / mostly test):
- Diamond Car Wash Rideau (`biz_mnmqsh4xnfygae`, +1 431 816 3850)
- Diamond Car Wash Findlay Creek (`biz_mnmmr26lnj5ug5`, +1 431 533 9146)
- Book8 Demo (`biz_book8demo`, no Twilio number, exists only in dashboard DB)

### Active lead pipeline:
- Soha (colleague) brings MENA leads — has a hot UAE prospect currently
- ~50 leads across 5 verticals in personalized outreach pipeline (Toronto + Canada-wide)

## 14. Business model and vision

- Bootstrapped, no external funding currently
- **6-month target** — $10K MRR
- **18-month target** — $100K MRR
- **Exit target** — $10M+ acquisition
- **Target acquirers** — Calendly, Booksy, Twilio, Square, or similar booking/communications platforms

### Moat:
- **Primary moat** — Multilingual voice AI in 70+ languages with depth (not just translation of English prompts, actual cultural and linguistic adaptation per vertical). No direct competitor matches this breadth.
- **Secondary moat** — MENA WhatsApp infrastructure depth (Infobip Imported WABA, multilingual templates, Arabic-native conversational handling)
- **Tertiary** — Multi-tenant architecture from day one. One ElevenLabs agent serves all businesses via dynamic variable routing, one Book8 WhatsApp number serves all businesses via [BIZ:biz_xxx] deep-link tokens

## 15. Communication preferences (CRITICAL — match these exactly)

When responding to WM:

- **Direct, no preamble.** Skip "Great question!" or "I'd be happy to help" or any pleasantries. Get to the answer.
- **No fluff or filler.** Every sentence must carry information.
- **Think globally.** Never mention Ottawa or Canada in marketing content unless explicitly relevant. Book8 is a global product, not a Canadian product.
- **Don't editorialize about session length, fatigue, or time of day.** Don't suggest he sleep, take a break, or stop. He pays for the tools and decides his own pace. If a stop is genuinely needed for some reason, ask "keep going or stop?" with zero preamble.
- **Don't be sassy or preachy** about security, compliance, or best practices. He knows.
- **Format for scanning** — bold, tables, bullet lists when content has structure. Dense prose paragraphs only when continuous reasoning matters.
- **Cite sources** with direct URLs at the end of any research answer.
- **For lead discovery / data tasks** — return clean lists / CSVs with no commentary unless explicitly requested. Don't explain what you're about to do. Just do it and show results.

## 16. Constraints and non-goals

Do NOT propose any of the following — they have been considered and rejected:

- **Don't suggest partnership with Newo.ai.** Acquisition optionality matters more than short-term revenue share.
- **Don't suggest dropping multilingual focus.** It is the moat.
- **Don't suggest dental / physio / medical verticals** until HIPAA path is built (separate roadmap).
- **Don't suggest VoIP solutions for UAE.** TDRA blocks at network layer; not solvable with config.
- **Don't suggest cardless trials for Growth plan.** Card-upfront has data-backed conversion advantage.
- **Don't suggest moving to Twilio for WhatsApp.** Infobip is the better BSP for Book8 MENA strategy, decision is locked.
- **Don't suggest reverting from MongoDB.** Atlas multi-tenancy works fine at current scale.

## 17. Active workstreams (May 2026)

- **In progress** — WhatsApp AI conversational handler (Claude Haiku 4.5 with 6 booking tools, multilingual)
- **Pending** — Multilingual template variants for Arabic/French/Spanish, WhatsApp voice notes via Whisper, UAE-specific landing page, homepage geo-detection
- **Backlog (compliance)** — TCPA audit, privacy/DPO email aliases, data export and delete-account, DPA template, caller-rights page, cookie banner refinement
- **Deferred to later milestones** — Vanta/Drata (defer to $5K MRR), pentest and bug bounty (defer to $2-5K MRR), Etisalat/du partnership for UAE voice (defer indefinitely), HIPAA path (when dental prospect appears)

## 18. Tools commonly used alongside Perplexity

WM uses Perplexity primarily for:

1. **Wizard auto-fill** — given a business URL, extract services, hours, location, photos, phone number and pre-fill the Book8 onboarding wizard
2. **RAG over business knowledge** — index business websites for runtime use by the AI handler
3. **Competitor monitoring** — automated daily check on Newo.ai for pricing/feature changes
4. **Lead enrichment** — given a business name or phone number, find website, social, contact info
5. **Browser automation** — find leads on Google Maps, Yelp, Instagram for cold outreach
6. **Market research** — telecom regulations, payment provider coverage, Meta policy changes

For ad-hoc factual questions during conversations, WM uses Claude (Anthropic) directly. For multi-step agentic tasks and production integrations, he prefers Perplexity.

---

## How to respond

1. **Lead with the answer.** Numbers, names, lists — whatever was specifically asked.
2. **Sources at the end** — direct URLs WM can verify.
3. **No restating the question, no preamble.**
4. Treat WM as a startup founder doing diligence, not a casual researcher. He moves fast and skims for value.
