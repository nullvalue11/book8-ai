export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Tavily:_selftest] Route hit')
    const key = process.env.TAVILY_API_KEY || null;
    return new Response(JSON.stringify({
      ok: true,
      route: '/api/search/_selftest',
      tavilyKeyPresent: !!key,
      tavilyKeyLen: key ? key.length : 0,
      runtime,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Tavily:_selftest] Error', err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}