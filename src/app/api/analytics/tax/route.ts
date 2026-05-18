import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const businessId = searchParams.get("businessId");
  const from       = searchParams.get("from"); // optional YYYY-MM-DD
  const to         = searchParams.get("to");   // optional YYYY-MM-DD

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  // Forward the caller's JWT so RLS (SECURITY INVOKER on the RPC) applies.
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const params: Record<string, string> = { p_business_id: businessId };
  if (from) params.p_from = from;
  if (to)   params.p_to   = to;

  const { data, error } = await supabase.rpc("get_tax_summary", params);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // RPC returns a set; we always expect exactly one row.
  return NextResponse.json((data as unknown[])?.[0] ?? null);
}

// Allow PATCH to save / upsert business VAT settings.
export async function PATCH(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const body = await req.json() as {
    has_vat: boolean;
    tax_percentage: number;
    tax_name: string;
  };

  const { error } = await supabase
    .from("business_invoice_settings")
    .upsert(
      {
        business_id:    businessId,
        has_vat:        body.has_vat,
        tax_percentage: body.tax_percentage,
        tax_name:       body.tax_name || "VAT",
        updated_at:     new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
