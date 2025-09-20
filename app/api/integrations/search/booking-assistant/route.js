import { NextResponse } from 'next/server'
import { tavily } from '@tavily/core'

// Helper function for CORS
function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization')
  resp.headers.set('Access-Control-Allow-Credentials', 'true')
  return resp
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

const json = (data, init = {}) => cors(NextResponse.json(data, init))

// Helper function to extract booking-relevant information
function extractBookingInfo(answer, results) {
  if (!answer) return null
  
  // Extract venues/locations
  const venuePatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hotel|Restaurant|Venue|Center|Hall|Room|Space|Studio|Office)\b/g,
    /\b(?:Hotel|Restaurant|Venue|Center|Hall|Room|Space|Studio|Office)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  ]
  
  let venues = []
  venuePatterns.forEach(pattern => {
    const matches = [...answer.matchAll(pattern)]
    venues.push(...matches.map(match => match[1] || match[0]))
  })
  
  // Extract dates
  const datePatterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/g,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g
  ]
  
  let dates = []
  datePatterns.forEach(pattern => {
    const matches = [...answer.matchAll(pattern)]
    dates.push(...matches.map(match => match[0]))
  })
  
  // Extract times
  const timePattern = /\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b/g
  const times = [...answer.matchAll(timePattern)].map(match => match[0])
  
  // Extract phone numbers
  const phonePattern = /(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g
  const phones = [...answer.matchAll(phonePattern)].map(match => match[0])
  
  // Extract contact info from results
  const contactInfo = results.slice(0, 3).map(result => ({
    name: result.title,
    url: result.url,
    description: result.content.substring(0, 200) + '...',
    relevance: result.score
  }))
  
  return {
    venues: [...new Set(venues)].slice(0, 5),
    dates: [...new Set(dates)].slice(0, 3),
    times: [...new Set(times)].slice(0, 5),
    phones: [...new Set(phones)].slice(0, 3),
    contacts: contactInfo,
    hasBookingInfo: venues.length > 0 || phones.length > 0 || contactInfo.length > 0
  }
}

export async function POST(request) {
  try {
    const { query, location, date, type } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return json({ error: 'Valid search query is required' }, { status: 400 })
    }
    
    if (!process.env.TAVILY_API_KEY) {
      return json({ error: 'Tavily API key not configured' }, { status: 500 })
    }
    
    // Enhance query with booking-specific context
    let enhancedQuery = query
    if (location) enhancedQuery += ` in ${location}`
    if (date) enhancedQuery += ` on ${date}`
    if (type) enhancedQuery += ` ${type}`
    
    // Add booking context keywords
    enhancedQuery += ' booking availability contact information phone address hours'
    
    console.log(`Booking assistant search: "${enhancedQuery}"`)
    
    // Initialize Tavily client
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY })
    
    // Perform enhanced search
    const searchResult = await tvly.search({
      query: enhancedQuery,
      max_results: 8,
      include_answer: true,
      search_depth: "advanced", // Use advanced search for better booking info
    })
    
    console.log(`Booking search completed: ${searchResult.results?.length || 0} results`)
    
    // Extract booking-specific information
    const bookingInfo = extractBookingInfo(searchResult.answer, searchResult.results || [])
    
    // Format response for Book8 AI booking context
    const response = {
      originalQuery: query,
      enhancedQuery: enhancedQuery,
      answer: searchResult.answer || null,
      bookingInfo: bookingInfo,
      results: (searchResult.results || []).map(result => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || '',
        score: result.score || 0,
        published_date: result.published_date || null,
      })),
      suggestions: {
        nextSteps: bookingInfo?.hasBookingInfo ? [
          'Call the venue directly using the phone numbers found',
          'Visit the venue websites for online booking',
          'Check availability for your preferred dates',
          'Compare different venue options'
        ] : [
          'Try searching with more specific location details',
          'Include preferred dates in your search',
          'Specify the type of venue you need'
        ]
      },
      total_results: searchResult.results?.length || 0,
      timestamp: new Date().toISOString(),
    }
    
    return json(response)
    
  } catch (error) {
    console.error('Booking assistant search error:', error)
    
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return json({ 
        error: 'Search quota exceeded. Please try again later.',
        type: 'quota_exceeded'
      }, { status: 429 })
    }
    
    if (error.message?.includes('unauthorized') || error.message?.includes('invalid key')) {
      return json({ 
        error: 'Invalid API configuration',
        type: 'auth_error'
      }, { status: 401 })
    }
    
    return json({ 
      error: 'Failed to perform booking search. Please try again.',
      type: 'search_error'
    }, { status: 500 })
  }
}