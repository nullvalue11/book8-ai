/**
 * Strict JSON schema for Perplexity Sonar extraction (BOO-PERPLEXITY-DOMAIN-EXTRACT-1B).
 * Nullable fields use type arrays so the model can return null instead of hallucinating.
 */

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'category',
    'address',
    'phone',
    'email',
    'hours',
    'services',
    'languages',
    'photos',
    'social',
    'tagline',
    'description'
  ],
  properties: {
    name: { type: ['string', 'null'] },
    tagline: { type: ['string', 'null'] },
    description: { type: ['string', 'null'], maxLength: 500 },
    category: {
      type: ['string', 'null'],
      enum: [
        'barber_shop',
        'beauty_salon',
        'hair_salon',
        'nail_salon',
        'spa',
        'gym',
        'fitness_studio',
        'yoga_studio',
        'pilates_studio',
        'car_wash',
        'auto_repair',
        'detailing',
        'restaurant',
        'cafe',
        'bar',
        'dentist',
        'physiotherapist',
        'chiropractor',
        'massage_therapist',
        'pet_grooming',
        'veterinary',
        'tattoo_parlor',
        'piercing_studio',
        'other',
        null
      ]
    },
    address: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['street', 'city', 'region', 'postalCode', 'country'],
      properties: {
        street: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] },
        region: { type: ['string', 'null'] },
        postalCode: { type: ['string', 'null'] },
        country: {
          type: ['string', 'null'],
          description: 'ISO 3166-1 alpha-2 (e.g. CA, US, AE)'
        }
      }
    },
    phone: {
      type: ['string', 'null'],
      description: 'E.164 format with leading +'
    },
    email: { type: ['string', 'null'] },
    hours: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      properties: {
        monday: { type: ['string', 'null'], description: 'e.g. 9:00-18:00, or closed, or null' },
        tuesday: { type: ['string', 'null'] },
        wednesday: { type: ['string', 'null'] },
        thursday: { type: ['string', 'null'] },
        friday: { type: ['string', 'null'] },
        saturday: { type: ['string', 'null'] },
        sunday: { type: ['string', 'null'] }
      }
    },
    services: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price', 'currency', 'durationMinutes', 'description'],
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          price: { type: ['number', 'null'] },
          currency: { type: ['string', 'null'], description: 'ISO 4217 e.g. USD, CAD, AED' },
          durationMinutes: { type: ['number', 'null'] }
        }
      }
    },
    languages: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', description: 'Languages the business serves customers in' }
    },
    photos: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', description: 'Absolute URL to a business photo' }
    },
    social: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['instagram', 'facebook', 'tiktok', 'twitter'],
      properties: {
        instagram: { type: ['string', 'null'] },
        facebook: { type: ['string', 'null'] },
        tiktok: { type: ['string', 'null'] },
        twitter: { type: ['string', 'null'] }
      }
    }
  }
}
