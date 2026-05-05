export const verticals = {
  barbershops: {
    slug: "barbershops",
    label: "Barbershops",
    badge: "For Barbershops",
    targetSearches: ["AI receptionist for barbershop", "barber booking AI"],
    heroHeadline:
      "AI receptionist for barbershops that books cuts, beard trims, and walk-ins 24/7",
    heroSubhead:
      "Stop losing $40-80 every time a regular calls and your shears are buzzing. Book8 answers every call in 1 second, books fades, line-ups, hot towel shaves, and beard trims — in 70+ languages — straight into your calendar.",
    scenarios: [
      'Walk-in caller asks for "the freshest fade you got" → AI confirms barber availability, books 30-min slot, sends SMS confirmation',
      'Regular calls in French to schedule his usual line-up → AI handles bilingually, recognizes returning client preferences',
      'Caller asks for "kid\'s haircut + beard trim for dad" → AI books two back-to-back appointments',
      "After-hours call asking about Sunday hours → AI explains Saturday closing time, books for next available slot"
    ],
    roiMath:
      "A typical barbershop misses 30-50% of calls during haircuts. At a $35 average ticket and 8-12 missed calls/day, that's $1,200-2,500/month in lost revenue — recovered for $99/month with Book8 Growth.",
    testimonialPlaceholder: "/* TODO: real testimonial when available */",
    ctaText: "Start your barbershop's 14-day free trial",
    searchCategoryDefault: "Barber",
    metaTitle: "Barbershops AI Receptionist — Book8 | Books Appointments 24/7 in 70+ Languages",
    metaDesc:
      "Stop losing $40-80 every time a regular calls and your shears are buzzing. Book8 answers every call in 1 second, books fades, line-ups, hot towel shaves, and beard trims — in 70+ languages — straight into your calendar."
  },
  dental: {
    slug: "dental",
    label: "Dental clinics",
    badge: "For Dental Clinics",
    targetSearches: ["AI receptionist dental", "dental AI booking"],
    heroHeadline: "AI receptionist for dental clinics — books cleanings, handles insurance, never misses a call",
    heroSubhead:
      "62% of dental calls go to voicemail when staff are with patients. Book8 picks up every call in 1 second, books cleanings, schedules follow-ups, and handles insurance pre-verification questions — in 70+ languages.",
    scenarios: [
      "New patient calls to schedule a cleaning → AI confirms accepted insurance, finds an open slot, sends a booking link",
      "Parent calls to book child's check-up → AI handles guardian information, books pediatric chair",
      "Existing patient asks about implant financing → AI explains payment plans, transfers complex questions to treatment coordinator",
      "After-hours emergency call → AI triages urgency, sends emergency contact info or books urgent same-day slot"
    ],
    roiMath:
      "A typical dental clinic misses 60-70% of after-hours calls. At a $200 average new-patient value, capturing just 2-3 missed calls per week pays for Book8 Growth 5-8x over.",
    testimonialPlaceholder: "/* TODO: real testimonial when available */",
    ctaText: "Start your clinic's 14-day free trial",
    searchCategoryDefault: "Dental",
    metaTitle: "Dental AI Receptionist — Book8 | Books Appointments 24/7 in 70+ Languages",
    metaDesc:
      "62% of dental calls go to voicemail when staff are with patients. Book8 picks up every call in 1 second, books cleanings, schedules follow-ups, and handles insurance pre-verification questions — in 70+ languages."
  },
  "spas-and-beauty": {
    slug: "spas-and-beauty",
    label: "Spas & beauty",
    badge: "For Spas & Beauty",
    targetSearches: ["AI receptionist beauty salon", "spa AI booking"],
    heroHeadline:
      "AI receptionist for beauty salons and spas — books balayage, facials, and treatments while you work",
    heroSubhead:
      "Your stylists can't answer phones with hands in someone's hair. Book8 answers every call instantly, books balayage, color correction, facials, manicures, and packages — in 70+ languages including French and Arabic.",
    scenarios: [
      'Client calls for "balayage with a glaze" → AI confirms 3-hour booking, asks about previous color treatments',
      'Walk-in caller asks for "next available facial" → AI checks aesthetician schedules, books soonest slot',
      "Bridal party caller wants 4 services for the same day → AI books group appointment with multiple stylists",
      'Caller in French asks about "épilation à la cire" → AI handles bilingually, books waxing service'
    ],
    roiMath:
      "A typical salon misses 40% of calls during peak appointments. At a $120 average service value and 15-20 missed calls/week, that's $7,200-9,600/month in lost revenue — recovered for $99/month with Book8 Growth.",
    testimonialPlaceholder: "/* TODO: real testimonial when available */",
    ctaText: "Start your salon's 14-day free trial",
    searchCategoryDefault: "Spa",
    metaTitle: "Beauty & Spa AI Receptionist — Book8 | Books Appointments 24/7 in 70+ Languages",
    metaDesc:
      "Your stylists can't answer phones with hands in someone's hair. Book8 answers every call instantly, books balayage, color correction, facials, manicures, and packages — in 70+ languages including French and Arabic."
  },
  "fitness-studios": {
    slug: "fitness-studios",
    label: "Fitness studios",
    badge: "For Fitness Studios",
    targetSearches: ["AI receptionist fitness", "gym booking AI"],
    heroHeadline: "AI receptionist for fitness studios — books classes, PT sessions, and tours 24/7",
    heroSubhead:
      "While your trainers are leading classes, callers are leaving voicemails and finding your competitor instead. Book8 answers every call in 1 second, books drop-ins, recurring classes, and PT consultations — in 70+ languages.",
    scenarios: [
      'Caller asks "do you have a 6 AM HIIT class?" → AI checks schedule, books drop-in, sends pre-class info',
      "New member asks for a tour → AI books a 30-min consultation with available trainer",
      "Existing member calls to book 10-class PT package → AI confirms recurring schedule, sends Stripe payment link",
      "After-hours caller asks about membership pricing → AI explains tiers, captures lead, sends follow-up SMS"
    ],
    roiMath:
      "Fitness studios lose 20-30% of new-member inquiries to voicemail. At a $150 average new-member LTV and 5-10 missed calls/week, Book8 pays for itself in the first 2 sign-ups each month.",
    testimonialPlaceholder: "/* TODO: real testimonial when available */",
    ctaText: "Start your studio's 14-day free trial",
    searchCategoryDefault: "Fitness",
    metaTitle: "Fitness Studio AI Receptionist — Book8 | Books Appointments 24/7 in 70+ Languages",
    metaDesc:
      "While your trainers are leading classes, callers are leaving voicemails and finding your competitor instead. Book8 answers every call in 1 second, books drop-ins, recurring classes, and PT consultations — in 70+ languages."
  },
  "physio-clinics": {
    slug: "physio-clinics",
    label: "Physio clinics",
    badge: "For Physio Clinics",
    targetSearches: ["AI receptionist physio", "physiotherapy AI booking"],
    heroHeadline:
      "AI receptionist for physiotherapy clinics — books assessments, manages referrals, handles insurance",
    heroSubhead:
      "Your therapists are with patients. Your front desk can't answer calls fast enough. Book8 answers every call in 1 second, books initial assessments, follow-ups, and handles insurance pre-verification — in 70+ languages.",
    scenarios: [
      "New patient calls with a doctor's referral → AI confirms insurance accepted, books 60-min initial assessment",
      "Existing patient needs follow-up after car accident → AI checks therapist availability, books 30-min follow-up",
      "Caller asks if direct billing is available → AI confirms accepted insurance providers, captures policy info securely",
      "After-hours caller asks about chiropractic services → AI books appointment with the right specialist on staff"
    ],
    roiMath:
      "Physio clinics typically miss 35% of calls during treatment hours. At a $90-120 per-session value and 10-15 missed calls/week, that's $4,000-7,000/month recoverable — for $99/month with Book8 Growth.",
    testimonialPlaceholder: "/* TODO: real testimonial when available */",
    ctaText: "Start your clinic's 14-day free trial",
    searchCategoryDefault: "Medical",
    metaTitle: "Physiotherapy AI Receptionist — Book8 | Books Appointments 24/7 in 70+ Languages",
    metaDesc:
      "Your therapists are with patients. Your front desk can't answer calls fast enough. Book8 answers every call in 1 second, books initial assessments, follow-ups, and handles insurance pre-verification — in 70+ languages."
  }
}

