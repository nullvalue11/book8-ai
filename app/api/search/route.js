import { TavilyClient } from "@tavily/core";
import { env } from '@/app/lib/env'

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { query } = await req.json();
    const client = new TavilyClient({
      apiKey: env.TAVILY_API_KEY,
    });
    const results = await client.search({ query });
    return Response.json({ ok: true, data: results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
