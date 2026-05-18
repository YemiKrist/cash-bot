import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TWILIO_ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_WHATSAPP_FROM  = process.env.TWILIO_WHATSAPP_FROM!; // e.g. "whatsapp:+14155238886"
const CRON_SECRET           = process.env.CRON_SECRET!;

interface ReminderRow {
  phone_number: string;
  morning_hour: number;
  evening_hour: number;
  timezone:     string;
}

// Returns the current hour (0–23) in the given IANA timezone.
function localHour(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  } catch {
    return (new Date().getUTCHours() + 1) % 24; // fallback: WAT (UTC+1)
  }
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: to, Body: body }).toString(),
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
  "Just reply with the details and I'll record them instantly.",
  'Example: "Received 150k from Acme Corp for Favsys"',
].join("\n");

const EVENING_MSG = [
  "🌙 Good evening! Before you wrap up the day —",
  "",
  "Any expenses or income from today still to be logged?",
  "",
  "Reply with the details and I'll take care of it.",
  'Example: "Spent 8k on diesel for the generator — Favsys"',
].join("\n");

// Vercel calls this endpoint every hour (see vercel.json).
// It sends WhatsApp reminders to every user whose morning_hour or
// evening_hour matches the current local hour in their timezone.
export async function GET(req: NextRequest) {
  // Vercel automatically attaches "Authorization: Bearer <CRON_SECRET>"
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: rows, error } = await supabase
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

  const sent: string[]   = [];
  const failed: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const hour      = localHour(row.timezone);
      const isMorning = hour === row.morning_hour;
      const isEvening = hour === row.evening_hour;

      if (!isMorning && !isEvening) return;

      try {
        await sendWhatsApp(row.phone_number, isMorning ? MORNING_MSG : EVENING_MSG);
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
