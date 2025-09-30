import TavilyClient from "@tavily/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    console.log('[Tavily:general] Route hit')
    const { query } = await req.json();
    if (!query) {
      return Response.json({ ok: false, error: "Missing query" }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 });
    }

    const client = new TavilyClient({ apiKey });
    const results = await client.search({ query });

    return Response.json({ ok: true, data: results });
  } catch (err) {
    console.error("[Tavily:general]", err);
    return Response.json({ ok: false, error: err?.message || 'Search failed' }, { status: 500 });
  }
}
