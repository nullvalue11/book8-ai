export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    console.log('[Tavily:general] Route hit')
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('[Tavily:general] Missing TAVILY_API_KEY')
      return Response.json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 });
    }

    const { query, maxResults = 5 } = await req.json();
    if (!query || typeof query !== 'string') {
      console.warn('[Tavily:general] Invalid query payload')
      return Response.json({ ok: false, error: 'query is required' }, { status: 400 });
    }

    const { TavilyClient } = await import('@tavily/core');
    const tavily = new TavilyClient({ apiKey });

    const res = await tavily.search({
      query,
      max_results: Math.min(Number(maxResults) || 5, 10)
    });

    return Response.json({ ok: true, data: res }, { status: 200 });
  } catch (err) {
    console.error('[Tavily:general] Error', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}