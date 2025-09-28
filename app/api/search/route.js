import { TavilyClient } from "@tavily/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    console.log('[Tavily:general] Route hit')
    const body = await req.json().catch(() => ({}));
    const query = typeof body === 'string' ? body : body?.query;
    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "Missing query" }), { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('[Tavily:general] Missing TAVILY_API_KEY')
      return new Response(JSON.stringify({ ok: false, error: 'TAVILY_API_KEY missing' }), { status: 500 });
    }

    // Instantiate client
    const client = new TavilyClient({ apiKey });

    // Prefer object signature for broader SDK compatibility
    const results = await client.search({ query });

    return new Response(JSON.stringify({ ok: true, data: results }), { status: 200 });
  } catch (err) {
    console.error("[Tavily:general]", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Search failed' }), { status: 500 });
  }
}