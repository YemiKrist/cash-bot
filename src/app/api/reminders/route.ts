import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEFAULTS = {
  enabled:      false,
  morning_hour: 9,
  evening_hour: 18,
  timezone:     "Africa/Lagos",
};

// Validate the caller's JWT and return their user_id, or null if invalid.
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token      = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user } } = await anon.auth.getUser(token);
  return user?.id ?? null;
}

// Service-role client — bypasses RLS (reminder_settings has no user-facing policies).
function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── GET /api/reminders ────────────────────────────────────────────────────────
// Returns the caller's reminder settings, or safe defaults if no row exists yet.
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await serviceClient()
    .from("reminder_settings")
    .select("enabled, morning_hour, evening_hour, timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? DEFAULTS);
}

// ── PATCH /api/reminders ──────────────────────────────────────────────────────
// Upserts morning_hour, evening_hour, timezone, and enabled for the caller.
export async function PATCH(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    enabled:      unknown;
    morning_hour: unknown;
    evening_hour: unknown;
    timezone:     unknown;
  };

  const { enabled, morning_hour, evening_hour, timezone } = body;

  if (
    typeof enabled      !== "boolean"                          ||
    !Number.isInteger(morning_hour) ||
    (morning_hour as number) < 0   || (morning_hour as number) > 23 ||
    !Number.isInteger(evening_hour) ||
    (evening_hour as number) < 0   || (evening_hour as number) > 23 ||
    typeof timezone !== "string"   || !(timezone as string).trim()
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("reminder_settings")
    .update({
      enabled,
      morning_hour,
      evening_hour,
      timezone:   (timezone as string).trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("phone_number");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "No reminder profile found. Send a WhatsApp message to CashBot first to register your number." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
