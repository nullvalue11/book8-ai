export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getTavilyCtor() {
  const mod = await import("@tavily/core");
  const TavClient = mod?.TavilyClient || mod?.default || mod?.Tavily;
  if (typeof TavClient !== "function") {
    throw new Error("TavilyClient export not found in @tavily/core");
  }
  return TavClient;
}

export async function POST(req) {
  try {
    console.log('[Tavily:booking-assistant] Route hit')
    const { prompt, context = {} } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ ok: false, error: 'prompt is required' }), { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('[Tavily:booking-assistant] Missing TAVILY_API_KEY')
      return new Response(JSON.stringify({ ok: false, error: 'TAVILY_API_KEY missing' }), { status: 500 });
    }

    const TavilyClient = await getTavilyCtor();
    const client = new TavilyClient({ apiKey });

    const enhanced = `Booking assistant task.\nContext: ${JSON.stringify(context)}\nUser prompt: ${prompt}`;
    const results = await client.search({ query: enhanced });

    const answer = {
      summary: results?.answer ?? null,
      sources: results?.results?.map(r => ({ title: r.title, url: r.url })) ?? []
    };

    return new Response(JSON.stringify({ ok: true, data: answer }), { status: 200 });
  } catch (err) {
    console.error('[Tavily:booking-assistant] Error', err)
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Assistant failed' }), { status: 500 });
  }
}