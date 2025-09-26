export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    console.log('[Tavily:booking-assistant] Route hit')
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('[Tavily:booking-assistant] Missing TAVILY_API_KEY')
      return Response.json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 });
    }

    const { prompt, context = {} } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      console.warn('[Tavily:booking-assistant] Invalid prompt payload')
      return Response.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const { TavilyClient } = await import('@tavily/core');
    const tavily = new TavilyClient({ apiKey });

    const q = `Booking assistant task.\n${JSON.stringify(context)}\nUser prompt: ${prompt}`;
    const res = await tavily.search({ query: q, max_results: 5 });

    const answer = {
      summary: res?.answer ?? null,
      sources: res?.results?.map(r => ({ title: r.title, url: r.url })) ?? []
    };

    return Response.json({ ok: true, data: answer }, { status: 200 });
  } catch (err) {
    console.error('[Tavily:booking-assistant] Error', err)
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}