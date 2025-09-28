import { TavilyClient } from "@tavily/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    console.log('[Tavily:general] Route hit')
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "Missing query" }), { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('[Tavily:general] Missing TAVILY_API_KEY')
      return new Response(JSON.stringify({ ok: false, error: 'TAVILY_API_KEY missing' }), { status: 500 });
    }

    // Correct instantiation
    const client = new TavilyClient({ apiKey });

    // Perform search (SDK supports passing a string query)
    const results = await client.search(query);

    return new Response(JSON.stringify({ ok: true, data: results }), { status: 200 });
  } catch (err) {
    console.error("[Tavily:general]", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}