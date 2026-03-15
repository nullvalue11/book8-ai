/**
 * Business categories for signup and provisioning.
 * Used for category-aware default services in core-api.
 * Sorted alphabetically by name with "Other" last.
 */
const RAW = [
  { key: 'dental', name: 'Dental Clinic' },
  { key: 'clinic', name: 'Medical Clinic' },
  { key: 'therapy', name: 'Therapy / Counseling' },
  { key: 'physiotherapy', name: 'Physiotherapy' },
  { key: 'chiropractic', name: 'Chiropractic' },
  { key: 'optometry', name: 'Optometry' },
  { key: 'veterinary', name: 'Veterinary Clinic' },
  { key: 'medspa', name: 'Med Spa' },
  { key: 'salon', name: 'Hair Salon' },
  { key: 'barber', name: 'Barber Shop' },
  { key: 'nails', name: 'Nail Salon' },
  { key: 'lash_brow', name: 'Lash & Brow Studio' },
  { key: 'tattoo', name: 'Tattoo Studio' },
  { key: 'spa', name: 'Spa' },
  { key: 'fitness', name: 'Fitness / Personal Training' },
  { key: 'yoga', name: 'Yoga Studio' },
  { key: 'martial_arts', name: 'Martial Arts' },
  { key: 'dance', name: 'Dance Studio' },
  { key: 'car_wash', name: 'Car Wash / Detailing' },
  { key: 'auto_repair', name: 'Auto Repair' },
  { key: 'auto_body', name: 'Auto Body Shop' },
  { key: 'home_services', name: 'Home Services' },
  { key: 'plumbing', name: 'Plumbing' },
  { key: 'hvac', name: 'HVAC' },
  { key: 'electrician', name: 'Electrician' },
  { key: 'cleaning', name: 'Cleaning Service' },
  { key: 'landscaping', name: 'Landscaping' },
  { key: 'legal', name: 'Law Firm / Legal' },
  { key: 'accounting', name: 'Accounting / Tax' },
  { key: 'consulting', name: 'Consulting' },
  { key: 'coaching', name: 'Coaching' },
  { key: 'real_estate', name: 'Real Estate' },
  { key: 'insurance', name: 'Insurance' },
  { key: 'tutoring', name: 'Tutoring' },
  { key: 'music_school', name: 'Music School' },
  { key: 'driving_school', name: 'Driving School' },
  { key: 'pet_grooming', name: 'Pet Grooming' },
  { key: 'photography', name: 'Photography Studio' },
  { key: 'other', name: 'Other' }
]

const byName = (a, b) => {
  if (a.key === 'other') return 1
  if (b.key === 'other') return -1
  return (a.name || '').localeCompare(b.name || '')
}

/** Sorted by name with "Other" last */
export const BUSINESS_CATEGORIES = [...RAW].sort(byName)

/** Key -> display name map */
export const CATEGORY_NAMES = Object.fromEntries(RAW.map(c => [c.key, c.name]))
