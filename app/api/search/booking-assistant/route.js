import { tavily } from "@tavily/core";
import { env } from '@/lib/env'

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { prompt, context = {} } = await req.json();
    const enhanced = `${prompt} (context: ${JSON.stringify(context)})`;
    const client = tavily({ apiKey: env.TAVILY_API_KEY });
    const results = await client.search({ query: enhanced });
    return Response.json({ ok: true, data: results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
