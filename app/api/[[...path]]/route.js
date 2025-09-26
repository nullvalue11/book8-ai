import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  return NextResponse.json(
    {
      ok: true,
      message: "Catch-all API placeholder. Specific routes live under /api/search.",
      path: params?.path || [],
      method: "GET",
    },
    { status: 200 }
  );
}

export async function POST(request, { params }) {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Catch-all API placeholder. This endpoint is not implemented yet in this build.",
      path: params?.path || [],
      method: "POST",
    },
    { status: 404 }
  );
}