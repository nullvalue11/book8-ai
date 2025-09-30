export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { query } = await req.json();
    
    // Use Tavily API directly instead of SDK
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query: query,
        search_depth: "basic",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: 5
      })
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
