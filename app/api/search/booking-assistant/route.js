import { TavilyClient } from "@tavily/core";
import { env } from '@/app/lib/env'

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { prompt, context = {} } = await req.json();
    const enhanced = `${prompt} (context: ${JSON.stringify(context)})`;
    const client = new TavilyClient({
      apiKey: env.TAVILY_API_KEY,
    });
    
    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }
    
    const results = await response.json();
    return Response.json({ ok: true, data: results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
