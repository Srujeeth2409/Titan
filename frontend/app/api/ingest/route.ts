import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const formData = await req.formData();
    const upstream = await fetch(`${backendUrl}/v1/ingest`, {
      method: "POST",
      body: formData,
      headers: req.headers.get("authorization") ? { Authorization: req.headers.get("authorization")! } : {},
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ingest failed to reach backend" },
      { status: 502 }
    );
  }
}
