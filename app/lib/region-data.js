/** Country + subdivision lists for business address (V1 — no autocomplete). */

import { COUNTRY_OPTIONS } from './countries'
export { COUNTRY_OPTIONS }

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
]

const CA_PROVINCES = [
  ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'],
  ['NL', 'Newfoundland and Labrador'], ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'],
  ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'],
  ['SK', 'Saskatchewan'], ['YT', 'Yukon']
]

const AU_STATES = [
  ['ACT', 'Australian Capital Territory'], ['NSW', 'New South Wales'], ['NT', 'Northern Territory'],
  ['QLD', 'Queensland'], ['SA', 'South Australia'], ['TAS', 'Tasmania'], ['VIC', 'Victoria'],
  ['WA', 'Western Australia']
]

/** @param {string} countryCode */
export function getSubdivisionsForCountry(countryCode) {
  const c = String(countryCode || '').toUpperCase()
  if (c === 'US') return US_STATES.map(([code, name]) => ({ code, name }))
  if (c === 'CA') return CA_PROVINCES.map(([code, name]) => ({ code, name }))
  if (c === 'AU') return AU_STATES.map(([code, name]) => ({ code, name }))
  return []
}

/** @param {string | undefined} tz IANA timezone */
export function guessCountryFromTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return 'US'
  const t = tz.toLowerCase()
  if (
    t.includes('toronto') ||
    t.includes('vancouver') ||
    t.includes('winnipeg') ||
    t.includes('halifax') ||
    t.includes('montreal') ||
    t.includes('edmonton') ||
    t.includes('calgary') ||
    t.includes('regina') ||
    t.includes('st_johns') ||
    t.includes('whitehorse') ||
    t.includes('yellowknife') ||
    t.includes('iqaluit') ||
    t === 'america/atikokan'
  ) {
    return 'CA'
  }
  if (t.startsWith('europe/london')) return 'GB'
  if (t.startsWith('australia/')) return 'AU'
  if (t.startsWith('pacific/auckland')) return 'NZ'
  if (t.startsWith('america/mexico') || t.includes('mexico')) return 'MX'
  if (t.startsWith('america/') || t.startsWith('us/')) return 'US'
  if (t.startsWith('europe/paris')) return 'FR'
  if (t.startsWith('europe/berlin')) return 'DE'
  if (t.startsWith('europe/madrid')) return 'ES'
  if (t.startsWith('europe/rome')) return 'IT'
  if (t.startsWith('asia/tokyo')) return 'JP'
  if (t.startsWith('asia/kolkata') || t.startsWith('asia/calcutta')) return 'IN'
  if (t.startsWith('america/sao_paulo')) return 'BR'
  return 'US'
}
