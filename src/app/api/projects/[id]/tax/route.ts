import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function supabaseForRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = supabaseForRequest(req);

  const { data, error } = await supabase
    .from("projects")
    .select("track_vat, track_wht, wht_rate_percent")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" },   { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = supabaseForRequest(req);

  const body = await req.json() as {
    track_vat:        boolean;
    track_wht:        boolean;
    wht_rate_percent: number;
  };

  const { error } = await supabase
    .from("projects")
    .update({
      track_vat:        body.track_vat,
      track_wht:        body.track_wht,
      wht_rate_percent: body.wht_rate_percent,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
