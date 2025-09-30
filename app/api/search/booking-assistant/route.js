import TavilyClient from "@tavily/core";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    console.log('[Tavily:booking-assistant] Route hit')
    const { prompt, context = {} } = await req.json();
    if (!prompt) {
      return Response.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 });
    }

    const enhanced = `${prompt} (context: ${JSON.stringify(context)})`;

    const client = new TavilyClient({ apiKey });
    const results = await client.search({ query: enhanced });

    return Response.json({ ok: true, data: results });
  } catch (err) {
    console.error('[Tavily:booking-assistant]', err)
    return Response.json({ ok: false, error: err?.message || 'Assistant failed' }, { status: 500 });
  }
}
