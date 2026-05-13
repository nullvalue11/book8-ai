# Book8 AI — Analysis Frameworks

Structured prompt templates for strategic analyses. Apply a framework **only when WM explicitly invokes it** by name or by clearly requesting that type of analysis. Otherwise respond conversationally per the `SKILL.md` communication preferences.

Each framework specifies exact structure, output format, and word limits. Follow them precisely.

---

## Framework 1 — Market breakdown

**Invoke when:** WM asks "do a market breakdown for [X]", "size the market for [Y]", "what's the TAM/SAM/SOM for [Z]", or similar.

Analyze the market for the specified topic. Use only specific, data-backed insights. No generic statements.

Deliver exactly four structured sections:

1. **Market sizing:** TAM, SAM, and SOM with estimated dollar values and your assumptions.
2. **Top 5 demand trends:** each as a one-line headline plus two-sentence explanation.
3. **Top 5 underserved opportunities:** specific gaps, not broad categories.
4. **Follow the money:** 3-5 areas where VC, PE, or acquirer capital is actively flowing.

Format each section with a bold heading, then concise bullet points. **Total output: under 600 words.**

---

## Framework 2 — Problem prioritization

**Invoke when:** WM asks "what are the top problems in [X] industry", "what should I be solving", or asks for a problem ranking.

List the top 10 problems in the specified industry.

For each problem, score on three dimensions:

- **Urgency (1-10):** how painful/time-sensitive it is right now.
- **Willingness to pay (1-10):** how likely buyers are to spend money to solve it today.
- **Growth trajectory:** `rising fast`, `stable`, or `declining`.

Also add a **Complaint signal** column: yes/no for whether this problem surfaces frequently in reviews, forums, or sales calls.

Output as a table with these exact columns:

| # | Problem | Urgency | WTP | Trend | Complaint signal | Why it ranks here |
|---|---|---|---|---|---|---|

Sort by combined Urgency + WTP score, **highest first**.

---

## Framework 3 — Offer creation

**Invoke when:** WM asks "create an offer for [X]", "what should the landing page say", "design a high-converting offer", or similar.

Create a high-converting offer for the specified product or problem.

Structure the output exactly like a landing page with these labeled sections **in order**:

1. **Headline:** one bold, benefit-driven statement.
2. **ICP:** who is this for (age, role, situation, pain level).
3. **Value proposition:** the core transformation in one sentence.
4. **Offer components:** what's included (deliverables, bonuses, format).
5. **Pricing tiers:** name, price, and what changes at each tier (low/mid/premium).
6. **Guarantee:** specific risk-reversal language the customer sees.
7. **Competitive edge:** 3 reasons this beats the obvious alternatives.

Keep each section tight. No filler. Write it as if it will go directly onto a real landing page.

---

## Framework 4 — Distribution domination plan (30-day)

**Invoke when:** WM asks "build a distribution plan", "30-day GTM plan", "how do I get my first 100 customers", or similar.

Act as a senior growth strategist.

Build a realistic 30-day distribution plan for the specified product, including the target audience, product type, and rough budget.

Deliverables:

1. **Top 5 acquisition channels:** ranked by cost-effectiveness for this specific audience.
2. **Content format per channel:** one specific format that works on each (short-form video, cold email sequence, SEO article, etc.).
3. **Weekly execution calendar:** what happens in week 1, 2, 3, and 4 (not day-by-day).
4. **Organic vs paid split:** recommended % allocation and rationale.
5. **Leverage plays:** 2-3 tactics that multiply reach without proportionally more effort (partnerships, repurposing, virality hooks).

Be specific and realistic. Skip tactics that require a large team or $50k+ budget unless the budget context supports it. **Output as a numbered system with clear section headers.**

---

## Framework 5 — Viral content engine

**Invoke when:** WM asks "create viral content strategy", "what content should I post", "give me hooks for [X]", or similar.

Create a viral content strategy for the specified niche.

Deliver four components:

1. **Hook bank:** 10 high-converting hooks (not 20 — prioritize quality). For each, label which emotional trigger it uses: fear of missing out (FOMO), social status, curiosity, or controversy.

2. **Content format matrix** — a table with these columns:

| Format | Platform | Ideal length | Why it spreads | Example title |
|---|---|---|---|---|

Include 6-8 formats across **at least 3 platforms**.

3. **Shareability audit:** for each format, answer "What makes someone forward/repost this?" in one sentence.

4. **Repeatable content system:** a simple weekly template showing how many posts, which formats, and what rotation keeps the audience engaged without burnout.

Output with bold section headers. Write the hooks in the voice of the niche, not generic marketing language.

---

## Framework 6 — Competitor weakness map

**Invoke when:** WM asks "analyze competitors for [X]", "competitor weakness map", "where are the gaps in [Y] market", or similar.

Analyze the top 5 competitors in the specified niche.

For each competitor, provide a structured row covering:

- **Name + one-line description** of their core offer.
- **What they do best** (their defensible strength).
- **Where they are weak** (product gaps, poor reviews, underserved use cases).
- **Which audience they ignore or underserve.**

Then, based on the pattern across all 5:

- **Gap analysis:** the 2-3 clearest white spaces no competitor is owning.
- **Positioning recommendation:** one sharp positioning statement that would differentiate a new entrant.
- **Go-to-market angle:** which ignored audience + which channel combination represents the fastest path to traction.

Output the competitor breakdown as a table, then the gap analysis and recommendations as prose.

---

## Framework 7 — Scale plan ($100K MRR in 5-8 months)

**Invoke when:** WM asks "scale plan", "how do I get to $100K MRR", "plan to scale to [X] revenue", or similar.

Give a plan to scale the business to the specified MRR target within the specified timeframe.

Default target if unspecified: **$100K MRR within 5-8 months from current state**.

Structure the plan as:

1. **Current state diagnosis** — where MRR is today, primary growth bottleneck, biggest unknown.
2. **Math to target** — required customer count by tier, required win rate, required pipeline volume.
3. **Channel mix** — which acquisition channels at which point in the timeline.
4. **Team / capacity plan** — what gets hired and when (if anything), or what gets outsourced.
5. **Product investments** — features or capabilities that unlock larger deals or new segments.
6. **Risk register** — top 3 things that could blow up the plan, plus mitigations.
7. **Monthly checkpoint targets** — MRR, customer count, churn benchmarks for months 1 through 8.

Be specific. Reference Book8's actual constraints (pre-revenue stage, sole-founder capacity, Newo.ai competitive pressure, MENA expansion). Total output: **under 1000 words**, scannable with bold subheadings.
