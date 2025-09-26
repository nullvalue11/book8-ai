export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 });
    }

    const { query, maxResults = 5 } = await req.json();
    if (!query || typeof query !== 'string') {
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
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}