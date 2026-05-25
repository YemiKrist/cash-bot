import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Read at call time so missing vars produce a clear 500 rather than a cryptic client error.
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[Env] Missing required variable: ${name}`);
  return val;
}

interface ReminderRow {
  phone_number: string;
  morning_hour: number | null;
  evening_hour: number | null;
  timezone:     string;
}

// Returns the current hour (0–23) in the given IANA timezone.
function localHour(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour:     "numeric",
      hour12:   false,
    }).formatToParts(new Date());
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  } catch {
    return (new Date().getUTCHours() + 1) % 24; // fallback: WAT (UTC+1)
  }
}

// Strict number equality — prevents hour 0 (12:00 AM) from being falsy-skipped.
function hourMatches(stored: number | null, current: number): boolean {
  return stored !== null && stored !== undefined && stored === current;
}

function toWhatsAppNumber(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function sendWhatsApp(
  accountSid: string,
  authToken:  string,
  fromNumber: string,
  to:         string,
  body:       string,
): Promise<void> {
  const url   = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const formattedFrom = toWhatsAppNumber(fromNumber);
  const formattedTo   = toWhatsAppNumber(to);

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: formattedFrom,
      To:   formattedTo,
      Body: body,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  }
}

const MORNING_MSG = [
  "🌅 Good morning! Quick check-in —",
  "",
  "Any expenses or income from today that haven't been logged yet?",
  "",
  "⚡ Quick-Log Formula (Runs Instantly):",
  "👉 [Amount], [Description], [Business/Ledger Name]",
  "• 150k, Acme Corp payment, Favsys",
  "• 45k, salary received, personal",
  "",
  "Just reply with the comma breakdown or type a normal message, and CashBot will handle the rest!",
].join("\n");

const EVENING_MSG = [
  "🌙 Good evening! Before you wrap up the day —",
  "",
  "Any expenses or income from today still to be logged?",
  "",
  "⚡ Quick-Log Formula (Runs Instantly):",
  "👉 [Amount], [Description], [Business/Ledger Name]",
  "• 8k, diesel for generator, Favsys",
  "• 200k, Naijasolve website, personal",
  "",
  "Just reply with the comma breakdown or type a normal message, and CashBot will handle the rest!",
].join("\n");

// ── GET /api/cron/send-reminders ──────────────────────────────────────────────
//
// Normal mode  (called by Vercel/external cron):
//   Authorization: Bearer <CRON_SECRET>
//   Sends to every enabled user whose morning_hour or evening_hour matches now.
//
// Test mode  (?test=true, called from the dashboard):
//   Authorization: Bearer <Supabase user JWT>
//   Skips hour matching and sends the morning message immediately to only
//   the authenticated user's phone number.
//
export async function GET(req: NextRequest) {
  // ── Resolve and guard all env vars at request time ──────────────────────────
  let SUPABASE_URL: string, SUPABASE_ANON_KEY: string, SUPABASE_SERVICE_KEY: string;
  let TWILIO_ACCOUNT_SID: string, TWILIO_AUTH_TOKEN: string, TWILIO_WHATSAPP_FROM: string;
  let CRON_SECRET: string;

  try {
    SUPABASE_URL         = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    SUPABASE_ANON_KEY    = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    TWILIO_ACCOUNT_SID   = requireEnv("TWILIO_ACCOUNT_SID");
    TWILIO_AUTH_TOKEN    = requireEnv("TWILIO_AUTH_TOKEN");
    TWILIO_WHATSAPP_FROM = requireEnv("TWILIO_WHATSAPP_FROM");
    CRON_SECRET          = requireEnv("CRON_SECRET");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Cron Initialization Error]", msg);
    return NextResponse.json({ error: "Server infrastructure misconfiguration", detail: msg }, { status: 500 });
  }

  const isTest     = req.nextUrl.searchParams.get("test") === "true";
  const authHeader = req.headers.get("authorization");

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Test mode: authenticate via Supabase JWT, scope to caller only ──────────
  if (isTest) {
    const token = (authHeader ?? "").replace(/^Bearer\s+/i, "");
    const anon  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user } } = await anon.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error } = await service
      .from("reminder_settings")
      .select("phone_number, morning_hour, evening_hour, timezone")
      .eq("user_id", user.id)
      .maybeSingle() as { data: ReminderRow | null; error: unknown };

    if (error) {
      console.error("[send-reminders/test] DB error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { error: "No reminder profile found. Send a WhatsApp message to CashBot first." },
        { status: 404 },
      );
    }

    try {
      await sendWhatsApp(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, row.phone_number, MORNING_MSG);
      console.log(`[send-reminders/test] ✓ ${row.phone_number}`);
      return NextResponse.json({ sent: 1, test: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[send-reminders/test] ✗ ${row.phone_number}:`, msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ── Normal cron mode: authenticate via CRON_SECRET ─────────────────────────
  const expectedAuth = `Bearer ${CRON_SECRET}`.trim();
  if (!authHeader || authHeader.trim() !== expectedAuth) {
    console.error(
      `[Cron Auth Failure] Expected: Bearer ${CRON_SECRET ? "Present" : "MISSING FROM ENVIRONMENT"}, Received: ${authHeader ?? "(none)"}`,
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await service
    .from("reminder_settings")
    .select("phone_number, morning_hour, evening_hour, timezone")
    .eq("enabled", true) as { data: ReminderRow[] | null; error: unknown };

  if (error) {
    console.error("[send-reminders] DB fetch error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ sent: 0, message: "No active reminders" });
  }

  const sent:   string[] = [];
  const failed: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const hour      = localHour(row.timezone);
      const isMorning = hourMatches(row.morning_hour, hour);
      const isEvening = hourMatches(row.evening_hour, hour);

      if (!isMorning && !isEvening) return;

      try {
        await sendWhatsApp(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, row.phone_number, isMorning ? MORNING_MSG : EVENING_MSG);
        sent.push(row.phone_number);
        console.log(`[send-reminders] ✓ ${row.phone_number} (${isMorning ? "morning" : "evening"})`);
      } catch (err) {
        failed.push(row.phone_number);
        console.error(`[send-reminders] ✗ ${row.phone_number}:`, err);
      }
    }),
  );

  return NextResponse.json({ sent: sent.length, failed: failed.length });
}
