// Force Node runtime so Tavily client works
export const runtime = 'nodejs';

export async function GET() {
  try {
    const key = process.env.TAVILY_API_KEY || null;
    const response = {
      ok: true,
      route: '/api/search/_selftest',
      tavilyKeyPresent: !!key,
      tavilyKeyLen: key ? key.length : 0,
      runtime: 'nodejs',
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}