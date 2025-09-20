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

export async function POST(request) {
  try {
    const { query, maxResults = 5, includeAnswer = true, searchDepth = "basic" } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return json({ error: 'Valid search query is required' }, { status: 400 })
    }
    
    if (!process.env.TAVILY_API_KEY) {
      return json({ error: 'Tavily API key not configured' }, { status: 500 })
    }
    
    console.log(`Tavily search request: "${query}"`)
    
    // Initialize Tavily client
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY })
    
    // Perform search
    const searchResult = await tvly.search({
      query,
      max_results: Math.min(maxResults, 10), // Cap at 10 for performance
      include_answer: includeAnswer,
      search_depth: searchDepth,
      include_domains: [], // Can be customized for specific domains
      exclude_domains: [], // Can exclude certain domains
    })
    
    console.log(`Tavily search completed: ${searchResult.results?.length || 0} results`)
    
    // Format response for Book8 AI context
    const response = {
      query: searchResult.query || query,
      answer: searchResult.answer || null,
      results: (searchResult.results || []).map(result => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || '',
        score: result.score || 0,
        published_date: result.published_date || null,
      })),
      total_results: searchResult.results?.length || 0,
      search_depth: searchDepth,
      timestamp: new Date().toISOString(),
    }
    
    return json(response)
    
  } catch (error) {
    console.error('Tavily search error:', error)
    
    // Handle specific Tavily API errors
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
      error: 'Failed to perform search. Please try again.',
      type: 'search_error'
    }, { status: 500 })
  }
}

// GET endpoint for testing and health check
export async function GET() {
  try {
    if (!process.env.TAVILY_API_KEY) {
      return json({ 
        status: 'error',
        message: 'Tavily API key not configured',
        configured: false
      }, { status: 500 })
    }
    
    return json({ 
      status: 'ready',
      message: 'Tavily search API is configured and ready',
      configured: true,
      endpoint: '/api/integrations/search'
    })
    
  } catch (error) {
    console.error('Tavily health check error:', error)
    return json({ 
      status: 'error',
      message: 'Tavily API health check failed',
      configured: false
    }, { status: 500 })
  }
}