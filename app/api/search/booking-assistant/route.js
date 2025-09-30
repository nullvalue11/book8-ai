import { Tavily } from "@tavily/core";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { prompt, context = {} } = await req.json();
    const enhanced = `${prompt} (context: ${JSON.stringify(context)})`;
    const client = new Tavily({
      apiKey: process.env.TAVILY_API_KEY,
    });
    const results = await client.search({ query: enhanced });
    return Response.json({ ok: true, data: results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
