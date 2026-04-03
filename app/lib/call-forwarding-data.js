/**
 * Carrier call-forwarding steps for /help/call-forwarding.
 * Use `{book8Number}` in strings — replaced at render with the Book8 line or a placeholder.
 */

/** @typedef {{ id: string, name: string, steps: string[], cancel: string, searchExtra?: string[] }} CallForwardingCarrier */

/** @typedef {{ id: string, flag: string, countryLabelKey: string, carriers: CallForwardingCarrier[] }} CallForwardingCountryGroup */

/** @type {CallForwardingCountryGroup[]} */
export const CALL_FORWARDING_COUNTRY_GROUPS = [
  {
    id: 'ca',
    flag: '🇨🇦',
    countryLabelKey: 'canada',
    carriers: [
      {
        id: 'bell-mobility',
        name: 'Bell Mobility',
        searchExtra: ['bell'],
        steps: [
          'From your phone, dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for a confirmation tone or message',
          'Hang up — forwarding is active'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'rogers',
        name: 'Rogers',
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation tone',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'telus',
        name: 'TELUS',
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation tone',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'fido',
        name: 'Fido',
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'koodo',
        name: 'Koodo',
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'freedom',
        name: 'Freedom Mobile',
        searchExtra: ['freedom'],
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'videotron',
        name: 'Vidéotron',
        searchExtra: ['videotron'],
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      }
    ]
  },
  {
    id: 'us',
    flag: '🇺🇸',
    countryLabelKey: 'unitedStates',
    carriers: [
      {
        id: 'att',
        name: 'AT&T',
        searchExtra: ['at&t', 'att'],
        steps: [
          'Dial `*72` (or `72#` on some devices)',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation tone or the call to connect briefly',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 't-mobile',
        name: 'T-Mobile',
        searchExtra: ['tmobile', 't mobile'],
        steps: [
          'Dial `**21*{book8Number}#`',
          'Press the call button',
          "You'll see a confirmation message on screen"
        ],
        cancel: 'Dial `##21#`'
      },
      {
        id: 'verizon',
        name: 'Verizon',
        steps: [
          'Dial `*72`',
          'Enter your Book8 number: {book8Number}',
          'Press the call button',
          'Wait for confirmation tone',
          'Hang up'
        ],
        cancel: 'Dial `*73`'
      },
      {
        id: 'sprint-tmobile',
        name: 'Sprint / T-Mobile (merged)',
        searchExtra: ['sprint'],
        steps: [
          'Same as T-Mobile: dial `**21*{book8Number}#`',
          'Press the call button',
          'Confirmation message appears on screen'
        ],
        cancel: 'Dial `##21#`'
      }
    ]
  },
  {
    id: 'uk',
    flag: '🇬🇧',
    countryLabelKey: 'unitedKingdom',
    carriers: ['EE', 'Vodafone UK', 'Three (3)', 'O2'].map((name, i) => ({
      id: `uk-${['ee', 'vodafone', 'three', 'o2'][i]}`,
      name,
      steps: [
        'Dial `**21*{book8Number}#`',
        'Press call',
        'Confirmation message appears'
      ],
      cancel: 'Dial `##21#`'
    }))
  },
  {
    id: 'au',
    flag: '🇦🇺',
    countryLabelKey: 'australia',
    carriers: ['Telstra', 'Optus', 'Vodafone AU'].map((name, i) => ({
      id: `au-${['telstra', 'optus', 'vodafone'][i]}`,
      name,
      searchExtra: i === 2 ? ['vodafone australia'] : undefined,
      steps: [
        'Dial `*21*{book8Number}#`',
        'Press call',
        'Wait for confirmation'
      ],
      cancel: 'Dial `#21#`'
    }))
  },
  {
    id: 'intl',
    flag: '🌍',
    countryLabelKey: 'international',
    carriers: [
      {
        id: 'gsm-standard',
        name: 'Most GSM carriers worldwide',
        searchExtra: ['gsm', 'international', 'global'],
        steps: [
          'Dial `**21*{book8Number}#`',
          'Press call',
          'You should see a confirmation message'
        ],
        cancel: 'Dial `##21#`'
      }
    ]
  }
]
