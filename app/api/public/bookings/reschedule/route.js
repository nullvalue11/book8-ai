export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: 'Not implemented yet' }), { status: 501, headers: { 'Content-Type': 'application/json' } })
}
