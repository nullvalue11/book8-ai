export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Helper function to extract booking-relevant information
function extractBookingInfo(answer, results) {
  if (!answer) return null;
  
  // Extract venues/locations
  const venuePatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hotel|Restaurant|Venue|Center|Hall|Room|Space|Studio|Office)\b/g,
    /\b(?:Hotel|Restaurant|Venue|Center|Hall|Room|Space|Studio|Office)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  ];
  
  let venues = [];
  venuePatterns.forEach(pattern => {
    const matches = [...answer.matchAll(pattern)];
    venues.push(...matches.map(match => match[1] || match[0]));
  });
  
  // Extract phone numbers
  const phonePattern = /(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const phones = [...answer.matchAll(phonePattern)].map(match => match[0]);
  
  // Extract contact info from results
  const contactInfo = results.slice(0, 3).map(result => ({
    name: result.title,
    url: result.url,
    description: result.content?.substring(0, 200) + '...',
    relevance: result.score
  }));
  
  return {
    venues: [...new Set(venues)].slice(0, 5),
    phones: [...new Set(phones)].slice(0, 3),
    contacts: contactInfo,
    hasBookingInfo: venues.length > 0 || phones.length > 0 || contactInfo.length > 0
  };
}

export async function POST(req) {
  try {
    const { query, location, date, type } = await req.json().catch(() => ({}));
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing "query"' }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === 'your_tavily_api_key_here') {
      console.error('TAVILY_ERROR: missing TAVILY_API_KEY');
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing Tavily API key. Please set TAVILY_API_KEY environment variable.' 
      }, { status: 500 });
    }

    // Enhance query with booking-specific context
    let enhancedQuery = query;
    if (location) enhancedQuery += ` in ${location}`;
    if (date) enhancedQuery += ` on ${date}`;
    if (type) enhancedQuery += ` ${type}`;
    
    // Add booking context keywords
    enhancedQuery += ' booking availability contact information phone address hours';

    console.log('[Tavily Booking Assistant] Original query:', query);
    console.log('[Tavily Booking Assistant] Enhanced query:', enhancedQuery);

    // Dynamic import to avoid compilation issues
    const { tavily } = await import('@tavily/core');
    const tavilyClient = tavily({ apiKey });

    const result = await tavilyClient.search({
      query: enhancedQuery,
      search_depth: 'advanced',
      include_answer: true,
      include_images: false,
      max_results: 8,
    });

    console.log('[Tavily Booking Assistant] Results:', result.results?.length || 0);

    // Extract booking-specific information
    const bookingInfo = extractBookingInfo(result.answer, result.results || []);

    // Basic "assistant" shaping – (keep simple and safe server-side)
    const venues = (result.results || [])
      .map(r => ({ title: r.title, url: r.url }))
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      originalQuery: query,
      enhancedQuery: enhancedQuery,
      answer: result.answer || null,
      bookingInfo: bookingInfo,
      venues,
      sources: (result.results || []).map(result => ({
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
      total_results: result.results?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('TAVILY_ERROR_BOOKING:', err?.stack || err);
    
    // Handle specific Tavily API errors
    if (err.message?.includes('quota') || err.message?.includes('limit')) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Search quota exceeded. Please try again later.',
        type: 'quota_exceeded'
      }, { status: 429 });
    }
    
    if (err.message?.includes('unauthorized') || err.message?.includes('invalid key')) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid Tavily API key. Please check your configuration.',
        type: 'auth_error'
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: 'Booking assistant search failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
}