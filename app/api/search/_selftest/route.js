export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.TAVILY_API_KEY || '';
  return NextResponse.json({
    ok: true,
    tavilyKeyPresent: Boolean(key && key !== 'your_tavily_api_key_here'),
    tavilyKeyLen: key ? key.length : 0,
    keyValue: process.env.NODE_ENV === 'development' ? key : (key ? `${key.slice(0, 8)}...${key.slice(-4)}` : 'none'),
    runtime: 'nodejs',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
}