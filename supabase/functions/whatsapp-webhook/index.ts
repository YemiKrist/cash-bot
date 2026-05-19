import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── TwiML helpers ─────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlOk(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}

function twimlMessage(body: string): Response {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = "inflow" | "outflow";
type FinancialTag =
  | "revenue"
  | "cogs"
  | "opex"
  | "personal_essential"
  | "personal_luxury";

interface ParsedTransaction {
  amount: number;
  transaction_type: TransactionType;
  financial_tag: FinancialTag;
  description: string;
  entity_prefix_guess: string | null;
  project_name: string | null;
  is_corporate_ambiguous: boolean;
  is_valid_transaction: boolean;
}

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
}

interface VatSettings {
  has_vat: boolean;
  tax_name: string;
  tax_percentage: number;
}

// ── Reminder command parser ───────────────────────────────────────────────────

type ReminderCmd =
  | { type: "enable" }
  | { type: "disable" }
  | { type: "status" }
  | { type: "set"; morning: number; evening: number };

function detectReminderCommand(text: string): ReminderCmd | null {
  const t = text.trim();

  if (/\b(enable|start|turn on|switch on)\b.*\breminder/i.test(t) ||
      /\breminder[s]?\s+(on|enable|start)\b/i.test(t)) {
    return { type: "enable" };
  }
  if (/\b(disable|stop|turn off|pause|switch off|cancel)\b.*\breminder/i.test(t) ||
      /\breminder[s]?\s+(off|disable|stop|pause)\b/i.test(t)) {
    return { type: "disable" };
  }
  if (/\breminder[s]?\s*(settings?|status|info|help)?\s*$/i.test(t) ||
      /\bmy reminders?\b/i.test(t)) {
    return { type: "status" };
  }

  // "Remind me at 9am and 6pm"  /  "Set reminder 8am 7pm"
  if (/\b(remind(er)?s?|set reminder)\b/i.test(t)) {
    const matches = [...t.matchAll(/(\d{1,2})(?::\d{2})?\s*(am|pm)/gi)];
    if (matches.length >= 2) {
      const toHour = (h: number, ap: string): number => {
        if (ap === "pm" && h !== 12) return h + 12;
        if (ap === "am" && h === 12) return 0;
        return h;
      };
      const morning = toHour(parseInt(matches[0][1]), matches[0][2].toLowerCase());
      const evening = toHour(parseInt(matches[1][1]), matches[1][2].toLowerCase());
      if (morning >= 0 && morning < 24 && evening >= 0 && evening < 24) {
        return { type: "set", morning, evening };
      }
    }
  }

  return null;
}

function fmtHour(h: number): string {
  if (h === 0)  return "12am (midnight)";
  if (h === 12) return "12pm (noon)";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

async function handleReminderCommand(
  supabase: ReturnType<typeof createClient>,
  from: string,
  userId: string,
  cmd: ReminderCmd,
): Promise<string> {
  const DEFAULT = { morning_hour: 9, evening_hour: 18, timezone: "Africa/Lagos" };

  if (cmd.type === "status") {
    const { data } = await supabase
      .from("reminder_settings")
      .select("enabled, morning_hour, evening_hour, timezone")
      .eq("phone_number", from)
      .maybeSingle() as { data: { enabled: boolean; morning_hour: number; evening_hour: number; timezone: string } | null };

    if (!data) {
      return [
        "📅 You don't have reminders set up yet.",
        "",
        "I'll remind you twice a day by default (9am & 6pm Lagos time).",
        "They activate automatically after your first logged transaction.",
        "",
        'To set custom times: "Remind me at 8am and 7pm"',
        'To disable: "Stop reminders"',
      ].join("\n");
    }

    return [
      `📅 *Reminder Settings*`,
      "",
      `Status: ${data.enabled ? "✅ Active" : "⏸️ Paused"}`,
      `Morning: ${fmtHour(data.morning_hour)}`,
      `Evening: ${fmtHour(data.evening_hour)}`,
      `Timezone: ${data.timezone}`,
      "",
      'To change times: "Remind me at 8am and 7pm"',
      `To ${data.enabled ? "disable" : "enable"}: "${data.enabled ? "Stop" : "Start"} reminders"`,
    ].join("\n");
  }

  if (cmd.type === "enable") {
    await supabase.from("reminder_settings").upsert(
      { phone_number: from, user_id: userId || null, enabled: true, ...DEFAULT, updated_at: new Date().toISOString() },
      { onConflict: "phone_number" },
    );
    // Fetch current times to confirm
    const { data } = await supabase
      .from("reminder_settings")
      .select("morning_hour, evening_hour")
      .eq("phone_number", from)
      .maybeSingle() as { data: { morning_hour: number; evening_hour: number } | null };
    const m = data?.morning_hour ?? DEFAULT.morning_hour;
    const e = data?.evening_hour ?? DEFAULT.evening_hour;
    return `✅ Reminders enabled! I'll check in at ${fmtHour(m)} and ${fmtHour(e)} (Lagos time) each day.\n\nTo adjust: "Remind me at 8am and 7pm"`;
  }

  if (cmd.type === "disable") {
    await supabase.from("reminder_settings")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("phone_number", from);
    return '⏸️ Reminders paused. Text "Start reminders" anytime to turn them back on.';
  }

  // cmd.type === "set"
  await supabase.from("reminder_settings").upsert(
    {
      phone_number: from,
      user_id: userId || null,
      enabled: true,
      morning_hour: cmd.morning,
      evening_hour: cmd.evening,
      timezone: DEFAULT.timezone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );
  return `✅ Done! I'll remind you at ${fmtHour(cmd.morning)} and ${fmtHour(cmd.evening)} (Lagos time) each day.`;
}

// ── Cancel / undo last transaction ───────────────────────────────────────────

function detectCancelCommand(text: string): boolean {
  const t = text.trim();
  return /^(cancel|undo|delete\s+last|cancel\s+last|cancel\s+that|undo\s+that|remove\s+last|revert\s+last)(\s+(transaction|entry|that|it))?$/i.test(t) ||
    /\b(cancel|undo|remove|delete)\b.{0,20}\b(last|that|previous|recent)\b.{0,30}(transaction|entry|record)?\b/i.test(t);
}

async function handleCancelCommand(
  supabase: ReturnType<typeof createClient>,
  from: string,
): Promise<string> {
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, amount, description, transaction_type, created_at")
    .eq("phone_number", from)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: {
        id: number;
        amount: number;
        description: string | null;
        transaction_type: string;
        created_at: string;
      } | null;
    };

  if (!tx) {
    return "❌ No recent transaction found to cancel. Only transactions logged via WhatsApp can be undone this way.";
  }

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", tx.id);

  if (delErr) {
    console.error("[cancel] delete failed:", delErr.message);
    return `❌ Could not cancel transaction: ${delErr.message}`;
  }

  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(tx.amount);

  console.log(`[cancel] deleted transaction ${tx.id} for ${from}`);

  return [
    "🗑️ Transaction cancelled!",
    "",
    `💰 ${tx.transaction_type === "inflow" ? "+" : "-"}${formatted}`,
    `📝 ${tx.description ?? "No description"}`,
    "",
    "It has been removed from your ledger.",
  ].join("\n");
}

// ── System instructions ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION_TEXT = `
You are a world-class accounting assistant for an entrepreneur who manages
multiple business entities and personal finances in Nigeria.

Analyze the conversational WhatsApp message and return a JSON object with
exactly these fields:

  amount                 number         Monetary value in NGN (strip ₦ symbols and commas)
  transaction_type       string         "inflow" or "outflow"
  financial_tag          string         One of: "revenue" | "cogs" | "opex" | "personal_essential" | "personal_luxury"
  description            string         One clean sentence summarising the transaction
  entity_prefix_guess    string|null    The exact business name mentioned, or null if none stated
  project_name           string|null    The exact project, client engagement, or deliverable name
                                        mentioned in the message (e.g. "Brand Identity Redesign",
                                        "Lekki Office Build-out", "Q3 Ad Campaign"). Return null
                                        if no specific project is mentioned. Do NOT guess or infer
                                        a project name — only extract one if the user states it.
  is_corporate_ambiguous boolean        Set to true when EITHER of these conditions applies:
                                        (A) The expense is unambiguously corporate: server hosting, software
                                            licenses, ad spend, client invoicing, B2B services, domain renewals,
                                            cloud tools, professional fees, staff salaries — AND no business
                                            name was mentioned.
                                        (B) The expense falls into a DUAL-USE category that is equally likely
                                            to be a business overhead as a personal cost:
                                            • Transportation / fuel / ride-hailing / logistics
                                            • Internet / data / broadband subscriptions
                                            • Meals / food / restaurants / catering
                                            • Utilities (electricity, water, generator fuel)
                                            • Accommodation / hotel
                                            — AND no business name was mentioned
                                            — AND the message contains NO explicit personal keyword
                                              (e.g. "personal", "family", "vacation", "holiday", "my wife",
                                               "kids", "school fees", "movie", "fun", "outing", "date").
                                        ALSO add to condition (B): AND no project name was stated.
                                        Set to false when: the expense is purely personal/lifestyle with a
                                        clear personal keyword, OR a business name is explicitly stated, OR
                                        a project name is explicitly stated (projects always belong to a
                                        business, so naming one is sufficient routing context), OR
                                        the transaction is an inflow/revenue.
  is_valid_transaction   boolean        true if the message describes any financial transaction with a
                                        discernible monetary amount. Set to false when the message is a
                                        greeting, a single word, a question, chitchat, or any text that
                                        does not contain an amount and a financial event.

Tag selection rules:
  revenue            → money received for services or sales (always inflow)
  cogs               → cost of goods sold, raw materials, production inputs (outflow)
  opex               → business running costs — software, ads, salaries, rent, tools (outflow)
  personal_essential → personal necessities — food, transport, healthcare, utilities (outflow)
  personal_luxury    → personal discretionary — dining out, entertainment, fashion, travel (outflow)

IMPORTANT: When is_corporate_ambiguous is true, still populate amount, transaction_type,
financial_tag, and description with your best guess — these will be used if the user
confirms a workspace. Set entity_prefix_guess to null.

When is_valid_transaction is false, you may set amount to 0 and leave other fields as
reasonable defaults — they will be ignored.

Return only the JSON object. No explanation, no markdown fencing.
`.trim();

const SYSTEM_INSTRUCTION_RECEIPT = `
You are a world-class accounting assistant for an entrepreneur who manages
multiple business entities and personal finances in Nigeria.

You will receive a receipt or invoice image. Extract all relevant financial
details and return a JSON object with exactly these fields:

  amount                 number         Grand total paid in NGN (strip ₦ symbols and commas)
  transaction_type       string         Always "outflow" for a receipt/purchase
  financial_tag          string         One of: "revenue" | "cogs" | "opex" | "personal_essential" | "personal_luxury"
  description            string         "{vendor_name} — {top line items summary}"
  entity_prefix_guess    string|null    Purchasing business name if visible on the receipt, else null
  project_name           string|null    Project or engagement name if printed on the receipt or
                                        invoice (e.g. in the line-item description, PO number field,
                                        or memo). Return null if not present.
  is_corporate_ambiguous boolean        Set to true when EITHER of these conditions applies:
                                        (A) The receipt is unambiguously corporate: SaaS invoice, cloud
                                            services, office supplies, professional services, equipment
                                            for business use — AND the purchasing business name does not
                                            appear on the receipt.
                                        (B) The receipt is from a dual-use category — fuel station,
                                            restaurant, hotel, ISP, utility provider — where the purchase
                                            could equally be a business overhead or personal expense, AND
                                            no business name is visible as the purchaser on the receipt.
                                        Set to false for clearly personal/consumer receipts (grocery
                                        supermarket, pharmacy, cinema, clothing retail) or when a
                                        business name is clearly printed as the buyer.
  is_valid_transaction   boolean        true if the image is a recognisable receipt, invoice, or financial
                                        document with a legible total amount. Set to false if the image is
                                        a selfie, screenshot of a chat, blank image, or otherwise contains
                                        no extractable financial data.

Tag selection rules:
  cogs               → purchased goods for resale or raw materials
  opex               → business tools, software, office supplies, services
  personal_essential → groceries, pharmacy, utilities, fuel, transport
  personal_luxury    → restaurants, bars, entertainment, fashion, electronics

Return only the JSON object. No explanation, no markdown fencing.
`.trim();

// ── Image helpers ─────────────────────────────────────────────────────────────

async function downloadTwilioImage(
  mediaUrl: string,
): Promise<{ buffer: Uint8Array; mimeType: string }> {
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Twilio image fetch ${res.status}: ${mediaUrl}`);

  const mimeType = res.headers.get("Content-Type") ?? "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: new Uint8Array(arrayBuffer), mimeType };
}

async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  buffer: Uint8Array,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "jpg";
  const path = `whatsapp/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}

function toBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary);
}

// ── Gemini calls ──────────────────────────────────────────────────────────────

// Retries on transient Gemini overload (503) and rate-limit (429) errors.
// Delays: 1 s → 2 s → 4 s before giving up after 3 retries.
async function geminiPost(
  label: string,
  body: unknown,
  maxRetries = 3,
): Promise<Response> {
  const RETRYABLE = new Set([429, 503]);
  let attempt = 0;

  while (true) {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok || !RETRYABLE.has(res.status) || attempt >= maxRetries) {
      return res;
    }

    const delay = 1000 * Math.pow(2, attempt);
    console.warn(`[${label}] Gemini ${res.status} — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
  }
}

async function extractFromText(rawText: string): Promise<ParsedTransaction> {
  const res = await geminiPost("extractFromText", {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] },
    contents: [{ parts: [{ text: rawText }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini text API ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini text: empty response");
  return JSON.parse(text) as ParsedTransaction;
}

async function extractFromImage(
  rawText: string,
  imageBuffer: Uint8Array,
  mimeType: string,
): Promise<ParsedTransaction> {
  const base64 = toBase64(imageBuffer);

  const res = await geminiPost("extractFromImage", {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_RECEIPT }] },
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: rawText || "Extract the financial details from this receipt." },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini vision API ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini vision: empty response");
  return JSON.parse(text) as ParsedTransaction;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
// Returns null on success, or a user-facing setup message string.
// Any unexpected error is thrown and caught by the HTTP handler.

async function runPipeline(
  rawText: string,
  from: string,
  mediaUrl: string | null,
): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Step B: Identify user ─────────────────────────────────────────────────
  // Primary: first row in businesses. Fallback: first user_id in transactions.
  const { data: businesses, error: bizErr } = await supabase
    .from("businesses")
    .select("id, user_id, name")
    .order("created_at", { ascending: true })
    .limit(50) as { data: BusinessRow[] | null; error: unknown };

  if (bizErr) console.error("[pipeline] businesses fetch error:", bizErr);

  let userId: string = businesses?.[0]?.user_id ?? "";

  if (!userId) {
    const { data: txRows } = await supabase
      .from("transactions")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(1)
      .single() as { data: { user_id: string } | null };

    userId = txRows?.user_id ?? "";
  }

  if (!userId) {
    console.error("[pipeline] Cannot resolve user_id — sending setup prompt");
    return "Setup incomplete. Please create your first workspace on the web dashboard before texting Cash Bot.";
  }

  // ── Step B2: Reminder command intercept ──────────────────────────────────
  const reminderCmd = detectReminderCommand(rawText);
  if (reminderCmd !== null) {
    return await handleReminderCommand(supabase, from, userId, reminderCmd);
  }

  // ── Step B3: Cancel / undo last transaction ───────────────────────────────
  if (detectCancelCommand(rawText)) {
    return await handleCancelCommand(supabase, from);
  }

  // ── Step C: Receipt download + storage upload (image path only) ──────────
  let mediaStorageUrl: string | null = null;
  let imageBuffer: Uint8Array | null = null;
  let imageMimeType = "image/jpeg";

  if (mediaUrl) {
    try {
      const { buffer, mimeType } = await downloadTwilioImage(mediaUrl);
      imageBuffer = buffer;
      imageMimeType = mimeType;
      mediaStorageUrl = await uploadToStorage(supabase, buffer, mimeType);
      console.log("[pipeline] Receipt stored →", mediaStorageUrl);
    } catch (err) {
      // Non-fatal: log and fall through to text-only parsing
      console.error("[pipeline] Image download/upload failed:", err);
    }
  }

  // ── Step D: AI semantic extraction ───────────────────────────────────────
  let parsed: ParsedTransaction;
  try {
    if (imageBuffer) {
      parsed = await extractFromImage(rawText, imageBuffer, imageMimeType);
      console.log("[pipeline] Gemini vision parsed:", parsed);
    } else {
      parsed = await extractFromText(rawText);
      console.log("[pipeline] Gemini text parsed:", parsed);
    }
  } catch (err) {
    // Re-throw so the HTTP handler surfaces it on the phone via twimlMessage
    throw err;
  }

  // ── Step D2: Invalid transaction intercept ────────────────────────────────
  if (!parsed.is_valid_transaction) {
    console.log("[pipeline] No valid transaction detected — returning guidance");
    return [
      "ℹ️ I couldn't find a transaction amount in that message.",
      "",
      "To log an expense, please resend the full sentence including the amount and workspace.",
      `Example: "Spent 55k on transportation for Favsys"`,
    ].join("\n");
  }

  // ── Step E: Ambiguity intercept ───────────────────────────────────────────
  // Skip when a project name was stated — Step F2 will resolve the business.
  if (parsed.is_corporate_ambiguous && !parsed.entity_prefix_guess && !parsed.project_name) {
    console.log("[pipeline] Dual-use / corporate ambiguity — requesting clarification");

    const businessLines = businesses?.map((b) => `• ${b.name}`).join("\n") ?? "";
    const exampleBiz = businesses?.[0]?.name ?? "My Business";

    return [
      "🤔 That could be a business expense or a personal one — I'm not sure which workspace to log it under!",
      "",
      "Please resend your message and specify a workspace:",
      "",
      "🏢 Corporate workspaces:",
      businessLines,
      "👤 • Personal Ledger",
      "",
      "Examples:",
      `"Paid 15,000 NGN for fuel for ${exampleBiz}"`,
      `"Spent 8,500 NGN on lunch — personal"`,
    ].join("\n");
  }

  // ── Step F: Context routing ───────────────────────────────────────────────
  let businessId: string | null = null;

  if (parsed.entity_prefix_guess && businesses?.length) {
    const guess = parsed.entity_prefix_guess.trim().toLowerCase();
    const match = businesses.find(
      (b) =>
        b.name.toLowerCase().includes(guess) ||
        guess.includes(b.name.toLowerCase()),
    );
    if (match) {
      businessId = match.id;
      console.log(`[pipeline] Routed → business "${match.name}" (${match.id})`);
    } else {
      console.log(
        `[pipeline] No business matched "${parsed.entity_prefix_guess}" — routing to Personal Ledger`,
      );
    }
  } else {
    console.log("[pipeline] No entity hint — routing to Personal Ledger");
  }

  // ── Step F2: Project resolution ───────────────────────────────────────────
  // Projects are scoped to a business. When businessId is null (Personal
  // Ledger) we skip silently — the schema requires a non-null business_id
  // on the projects table.
  let projectId: string | null = null;
  let resolvedProjectName: string | null = null;
  let projectLinkFailed = false;   // set when DB write succeeded but project could not be linked

  const rawProjectName = parsed.project_name?.trim() ?? null;

  if (businessId && rawProjectName && rawProjectName.length > 0) {
    // ── 1. Case-insensitive lookup for an existing project ─────────────────
    const { data: existingProj } = await supabase
      .from("projects")
      .select("id, name")
      .eq("business_id", businessId)
      .filter("name", "ilike", rawProjectName)
      .maybeSingle() as { data: { id: string; name: string } | null };

    if (existingProj) {
      projectId = existingProj.id;
      resolvedProjectName = existingProj.name;
      console.log(`[pipeline] Project matched → "${existingProj.name}" (${existingProj.id})`);
    } else {
      // ── 2. No match — auto-create the project for this business ───────────
      console.log(`[pipeline] Project "${rawProjectName}" not found — creating`);

      const { data: newProj, error: projCreateErr } = await supabase
        .from("projects")
        .insert({ business_id: businessId, name: rawProjectName })
        .select("id, name")
        .single() as { data: { id: string; name: string } | null; error: { code: string; message: string } | null };

      if (projCreateErr) {
        if (projCreateErr.code === "23505") {
          // Race condition: a concurrent request already created this project.
          // Retry the lookup with the exact name that caused the conflict.
          console.log("[pipeline] Race condition (23505) — fetching existing project");
          const { data: racedProj } = await supabase
            .from("projects")
            .select("id, name")
            .eq("business_id", businessId)
            .filter("name", "ilike", rawProjectName)
            .maybeSingle() as { data: { id: string; name: string } | null };

          if (racedProj) {
            projectId = racedProj.id;
            resolvedProjectName = racedProj.name;
            console.log(`[pipeline] Race resolved → "${racedProj.name}" (${racedProj.id})`);
          } else {
            // Extremely unlikely: conflict but still can't find it — non-fatal.
            console.error("[pipeline] Race-condition recovery failed — saving without project");
            projectLinkFailed = true;
          }
        } else {
          // Any other DB error — non-fatal, transaction still saves, but we
          // surface it clearly in the confirmation reply so the user knows.
          console.error("[pipeline] Project create failed:", projCreateErr.message);
          projectLinkFailed = true;
        }
      } else if (newProj) {
        projectId = newProj.id;
        resolvedProjectName = newProj.name;
        console.log(`[pipeline] New project created → "${newProj.name}" (${newProj.id})`);
      } else {
        // insert returned no data and no error — shouldn't happen but guard it.
        console.error("[pipeline] Project insert returned neither data nor error");
        projectLinkFailed = true;
      }
    }
  } else if (!businessId && rawProjectName && rawProjectName.length > 0) {
    // No business stated — search the project name across ALL businesses.
    // If exactly one match: infer the business. If multiple: ask for clarification.
    const { data: crossMatches } = await supabase
      .from("projects")
      .select("id, name, business_id")
      .ilike("name", rawProjectName) as {
        data: { id: string; name: string; business_id: string }[] | null;
      };

    if (crossMatches && crossMatches.length === 1) {
      projectId = crossMatches[0].id;
      resolvedProjectName = crossMatches[0].name;
      businessId = crossMatches[0].business_id;
      console.log(`[pipeline] Project "${resolvedProjectName}" inferred business ${businessId}`);
    } else if (crossMatches && crossMatches.length > 1) {
      // Project exists in multiple businesses — need clarification.
      const bizNames = crossMatches
        .map((p) => businesses?.find((b) => b.id === p.business_id)?.name)
        .filter(Boolean) as string[];
      const exampleBiz = bizNames[0] ?? "My Business";
      return [
        `🤔 I found a project called "${rawProjectName}" in multiple businesses:`,
        "",
        ...bizNames.map((n) => `• ${n}`),
        "",
        "Please resend and specify which business:",
        `Example: "Spent 50k on design for ${rawProjectName} — ${exampleBiz}"`,
      ].join("\n");
    } else {
      console.log(`[pipeline] Project "${rawProjectName}" not found in any business — routing to Personal Ledger`);
    }
  }

  // ── Step F3: VAT settings lookup ──────────────────────────────────────────
  // Fetch once here so the confirmation reply can inform the user when their
  // expense will factor into the dashboard's Input VAT calculation.
  // Defaults apply when no settings row exists yet (new business).
  let vatSettings: VatSettings = { has_vat: false, tax_name: "VAT", tax_percentage: 7.5 };

  if (businessId) {
    const { data: vatRow } = await supabase
      .from("business_invoice_settings")
      .select("has_vat, tax_name, tax_percentage")
      .eq("business_id", businessId)
      .maybeSingle() as { data: VatSettings | null };

    if (vatRow) vatSettings = vatRow;
    console.log(`[pipeline] VAT settings for business ${businessId}:`, vatSettings);
  }

  // ── Step G: Database ingestion ────────────────────────────────────────────
  const { error: insertErr } = await supabase.from("transactions").insert({
    user_id: userId,
    business_id: businessId,
    project_id: projectId,
    phone_number: from,
    amount: parsed.amount,
    transaction_type: parsed.transaction_type,
    financial_tag: parsed.financial_tag,
    description: parsed.description,
    raw_text: rawText,
    media_storage_url: mediaStorageUrl,
    created_at: new Date().toISOString(),
  });

  if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

  console.log("[pipeline] Transaction saved ✓", { projectId });

  // Auto-register reminder settings on first transaction (ignoreDuplicates preserves custom settings)
  supabase.from("reminder_settings").upsert(
    {
      phone_number: from,
      user_id: userId || null,
      enabled: true,
      morning_hour: 9,
      evening_hour: 18,
      timezone: "Africa/Lagos",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number", ignoreDuplicates: true },
  ).then(() => {});

  const workspaceName = businessId
    ? (businesses?.find((b) => b.id === businessId)?.name ?? "Business")
    : "Personal Ledger";

  const formattedAmount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(parsed.amount);

  const lines = [
    "✅ Transaction Logged!",
    "",
    `💰 Amount: ${formattedAmount}`,
    `🏷️ Tag: ${parsed.financial_tag}`,
    `📁 Workspace: ${workspaceName}`,
  ];

  if (resolvedProjectName) {
    lines.push(`📂 Project: ${resolvedProjectName}`);
  } else if (projectLinkFailed && rawProjectName) {
    lines.push(`⚠️ Project: Could not link to "${rawProjectName}" — saved as Unassigned`);
  }
  lines.push(`📝 Description: ${parsed.description}`);

  // Inform the user when this outflow will reduce their VAT liability.
  // cogs and opex are the two tags the get_tax_summary RPC counts as Input VAT.
  const isInputVatEligible =
    vatSettings.has_vat &&
    parsed.transaction_type === "outflow" &&
    (parsed.financial_tag === "cogs" || parsed.financial_tag === "opex");

  if (isInputVatEligible) {
    lines.push(
      `\n🧾 ${vatSettings.tax_name} Deductible: This expense factors into your Input ${vatSettings.tax_name} on the dashboard (${vatSettings.tax_percentage}% of ₦${parsed.amount.toLocaleString("en-NG")}).`,
    );
  }

  return lines.join("\n");
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  // Step A: Parse Twilio urlencoded payload
  const form = await req.formData();
  const rawText: string = (form.get("Body") as string | null) ?? "";
  const from: string = (form.get("From") as string | null) ?? "";
  const mediaUrl: string | null = form.get("MediaUrl0") as string | null;

  console.log("[whatsapp-webhook] incoming", {
    from,
    bodyPreview: rawText.slice(0, 80),
    hasMedia: mediaUrl !== null,
  });

  try {
    const reply = await runPipeline(rawText, from, mediaUrl);
    return twimlMessage(reply ?? "✅ Done.");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp-webhook] pipeline crash:", detail);
    // Surface the raw error directly on the phone for fast debugging
    return twimlMessage(`⚠️ CashBot Error: ${detail}`);
  }
});
