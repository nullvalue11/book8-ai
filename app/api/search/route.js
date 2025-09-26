export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { query, maxResults = 5, depth = 'advanced' } = await req.json().catch(() => ({}));

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

    console.log('[Tavily General Search] Query:', query);

    // Dynamic import to avoid compilation issues
    const { tavily } = await import('@tavily/core');
    const tavilyClient = tavily({ apiKey });

    const result = await tavilyClient.search({
      query,
      search_depth: depth,
      include_answer: true,
      include_images: false,
      max_results: Math.min(Math.max(Number(maxResults) || 5, 1), 10),
    });

    console.log('[Tavily General Search] Results:', result.results?.length || 0);

    return NextResponse.json({
      ok: true,
      query: result.query || query,
      answer: result.answer || null,
      results: (result.results || []).map(r => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        score: r.score || 0,
        published_date: r.published_date || null,
      })),
      total_results: result.results?.length || 0,
      timestamp: new Date().toISOString(),
      usage: result.response_time ? { response_time_ms: result.response_time } : undefined,
    });
  } catch (err) {
    console.error('TAVILY_ERROR_GENERAL:', err?.stack || err);
    
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
      error: 'Search failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    return NextResponse.json({ 
      ok: true,
      status: 'ready',
      message: 'Tavily search API is ready',
      configured: !!(apiKey && apiKey !== 'your_tavily_api_key_here'),
      endpoint: '/api/search'
    });
  } catch (error) {
    console.error('TAVILY_ERROR_HEALTH:', error);
    return NextResponse.json({ 
      ok: false,
      status: 'error',
      message: 'Tavily API health check failed',
      configured: false
    }, { status: 500 });
  }
}