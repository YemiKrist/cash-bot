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

function twimlMessageWithButtons(
  body: string,
  buttons: { title: string; payload: string }[],
): Response {
  const btnXml = buttons
    .map((b) => `<Button payload="${escapeXml(b.payload)}">${escapeXml(b.title)}</Button>`)
    .join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${escapeXml(body)}</Body><Action>${btnXml}</Action></Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

interface ListRow {
  id: string;       // sent back as ButtonPayload when the user selects the row
  title: string;    // max 24 chars — WhatsApp enforced limit
  description: string;
}

function twimlMessageWithList(
  body: string,
  buttonText: string,
  sectionTitle: string,
  rows: ListRow[],
): Response {
  const rowXml = rows
    .map(
      (r) =>
        `<Row id="${escapeXml(r.id)}" title="${escapeXml(r.title)}" description="${escapeXml(r.description)}"/>`,
    )
    .join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${escapeXml(body)}</Body><Action><List buttonText="${escapeXml(buttonText)}"><Section title="${escapeXml(sectionTitle)}">${rowXml}</Section></List></Action></Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Tag selection rows — each id is parsed by parseButtonPayload as TAG_SELECT|<tag>.
const TAG_SELECTION_ROWS: ListRow[] = [
  {
    id:          "TAG_SELECT|revenue",
    title:       "💰 Sales & Income",
    description: "Customer payments, daily shop sales, or contract payouts",
  },
  {
    id:          "TAG_SELECT|cogs",
    title:       "📦 Stock & Materials",
    description: "Wholesale restocking, raw materials, or direct project inputs",
  },
  {
    id:          "TAG_SELECT|opex",
    title:       "⚡ Daily Running Costs",
    description: "Generator fuel, transport, data/airtime, ads, or daily logistics",
  },
  {
    id:          "TAG_SELECT|fixed_cost",
    title:       "📅 Monthly Overheads",
    description: "Shop/office rent, regular staff salaries, or recurring bills",
  },
  {
    id:          "TAG_SELECT|capex",
    title:       "🔌 Equipment & Assets",
    description: "Buying long-term assets like generators, laptops, or machinery",
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = "inflow" | "outflow";
type FinancialTag =
  | "revenue"
  | "cogs"
  | "opex"
  | "fixed_cost"
  | "capex"
  | "personal_essential"
  | "personal_luxury"
  | "bills_utilities"
  | "savings_investment";

interface ParsedTransaction {
  amount: number;
  transaction_type: TransactionType;
  financial_tag: FinancialTag;
  description: string;
  entity_prefix_guess: string | null;
  project_name: string | null;
  is_corporate_ambiguous: boolean;
  is_tag_ambiguous?: boolean;   // true when Gemini can't confidently assign a tag
  is_valid_transaction: boolean;
}

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
}

// Project-level tax columns — source of truth for VAT and WHT tracking.
interface ProjectTaxConfig {
  track_vat: boolean;
  track_wht: boolean;
  wht_rate_percent: number;
}

// Internal resolved config passed to computeTaxBreakdown.
interface EffectiveTaxConfig {
  enable_vat: boolean;
  vat_rate: number;
  enable_wht: boolean;
  wht_rate: number;
}

interface TaxBreakdown {
  gross_amount: number;
  core_revenue: number;        // Excl. VAT when VAT-enabled; equals gross otherwise
  tax_vat_amount: number;      // 0 when VAT disabled
  tax_wht_amount: number;      // 0 when WHT disabled
  net_amount_received: number; // Cash actually received after WHT deduction
  vat_enabled: boolean;
  vat_rate: number;
  wht_enabled: boolean;
  wht_rate: number;
}

// ── Tax helpers ────────────────────────────────────────────────────────────────

function fmtNGN(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function computeTaxBreakdown(amount: number, cfg: EffectiveTaxConfig): TaxBreakdown {
  // VAT: amount received is inclusive of VAT, so true revenue = gross / (1 + rate).
  const vatDivisor = 1 + cfg.vat_rate / 100;
  const whtFraction = cfg.wht_rate / 100;

  const core_revenue   = cfg.enable_vat ? amount / vatDivisor : amount;
  const tax_vat_amount = cfg.enable_vat ? amount - core_revenue : 0;

  // WHT: client withholds wht_rate% before remitting; vendor receives the rest.
  const tax_wht_amount    = cfg.enable_wht ? amount * whtFraction : 0;
  const net_amount_received = cfg.enable_wht ? amount - tax_wht_amount : amount;

  return {
    gross_amount: amount,
    core_revenue,
    tax_vat_amount,
    tax_wht_amount,
    net_amount_received,
    vat_enabled: cfg.enable_vat,
    vat_rate:    cfg.vat_rate,
    wht_enabled: cfg.enable_wht,
    wht_rate:    cfg.wht_rate,
  };
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

  console.log(`[cancel] deleted transaction ${tx.id} for ${from}`);

  return [
    "🗑️ Transaction cancelled!",
    "",
    `💰 ${tx.transaction_type === "inflow" ? "+" : "-"}${fmtNGN(tx.amount)}`,
    `📝 ${tx.description ?? "No description"}`,
    "",
    "It has been removed from your ledger.",
  ].join("\n");
}

// ── Phase 1: Interactive button routing ──────────────────────────────────────

type ButtonAction =
  | { kind: "cancel_last" }
  | { kind: "change_workspace"; transactionId: string }  // re-routes an already-committed tx
  | { kind: "tag_select"; tag: FinancialTag }            // category selection from the list menu
  | { kind: "confirm_personal"; amount: number; tag: FinancialTag; description: string }
  | { kind: "confirm_business"; businessId: string; amount: number; tag: FinancialTag; description: string }
  | { kind: "select_scope_personal" }                    // loads pending tx from session → Personal Ledger
  | { kind: "select_scope_biz"; businessId: string };    // loads pending tx from session → named business

function parseButtonPayload(payload: string): ButtonAction | null {
  const p = payload.trim();

  if (p === "CANCEL_LAST_TX") return { kind: "cancel_last" };

  const changeWsM = p.match(/^change_workspace_(.+)$/);
  if (changeWsM) return { kind: "change_workspace", transactionId: changeWsM[1] };

  // Tag selection from the list menu — payload format: TAG_SELECT|<tag>
  const tagSelM = p.match(/^TAG_SELECT\|(.+)$/);
  if (tagSelM) return { kind: "tag_select", tag: tagSelM[1] as FinancialTag };

  // Scope-selection buttons sent alongside the ambiguity clarification message.
  if (p === "SELECT_PERSONAL") return { kind: "select_scope_personal" };
  const scopeBizM = p.match(/^SELECT_BIZ\|([^|]+)$/);
  if (scopeBizM) return { kind: "select_scope_biz", businessId: scopeBizM[1] };

  // LOG_PERSONAL|amount|tag|description
  const personalM = p.match(/^LOG_PERSONAL\|(\d+(?:\.\d+)?)\|([^|]+)\|(.+)$/);
  if (personalM) {
    return {
      kind: "confirm_personal",
      amount: parseFloat(personalM[1]),
      tag: personalM[2] as FinancialTag,
      description: personalM[3],
    };
  }

  // LOG_BIZ|businessId|amount|tag|description
  const bizM = p.match(/^LOG_BIZ\|([^|]+)\|(\d+(?:\.\d+)?)\|([^|]+)\|(.+)$/);
  if (bizM) {
    return {
      kind: "confirm_business",
      businessId: bizM[1],
      amount: parseFloat(bizM[2]),
      tag: bizM[3] as FinancialTag,
      description: bizM[4],
    };
  }

  return null;
}

// ── Phase 2: 3-Tier shorthand + comma protocol ───────────────────────────────
//
// Tier 1 — Simple shorthand (no comma): "15k fuel", "5k uber"
//   Amount + keyword → Personal Ledger. No AI, no DB lookup.
//
// Tier 2 — Comma protocol: "15k, description" / "15k, description, scope"
//   2-part → Personal Ledger.  3-part → DB lookup for scope then commit.
//
// Tier 3 — Natural text (no comma, no keyword match) → falls to Gemini.

interface ShortcutMatch {
  amount:           number;
  transaction_type: TransactionType;
  financial_tag:    FinancialTag;
  label:            string;
}

const SHORTCUT_KEYWORDS: {
  pattern: RegExp;
  type: TransactionType;
  tag: FinancialTag;
  label: string;
}[] = [
  { pattern: /\b(fuel|petrol|diesel|generator|gen)\b/i,                       type: "outflow", tag: "personal_essential", label: "Fuel"         },
  { pattern: /\b(transport|uber|bolt|taxi|bus|okada|keke|ride|drop)\b/i,       type: "outflow", tag: "personal_essential", label: "Transport"    },
  { pattern: /\b(lunch|dinner|breakfast|food|eat|snack|meal|supper)\b/i,       type: "outflow", tag: "personal_essential", label: "Food"         },
  { pattern: /\b(data|airtime|recharge|mtn|glo|airtel|9mobile|sim)\b/i,        type: "outflow", tag: "personal_essential", label: "Airtime/Data" },
  { pattern: /\b(salary|salaries|staff|wages|payroll)\b/i,                     type: "outflow", tag: "opex",               label: "Salary"       },
  { pattern: /\b(rent|office\s*rent|shop\s*rent)\b/i,                          type: "outflow", tag: "opex",               label: "Rent"         },
  { pattern: /\b(ads?|advert(?:isement)?|marketing|promotion|boost)\b/i,       type: "outflow", tag: "opex",               label: "Marketing"    },
  { pattern: /\b(received|payment|paid\s*me|client\s*paid|invoice\s*paid)\b/i, type: "inflow",  tag: "revenue",            label: "Income"       },
];

// Matches Tier 1 messages: {digits}[.digits][k?] then a space then keyword words.
const SHORTCUT_RE = /^(\d+(?:[.,]\d+)?)(k)?\s+(.+)$/i;

function matchShortcut(text: string): ShortcutMatch | null {
  const m = text.trim().match(SHORTCUT_RE);
  if (!m) return null;

  const rawNum = parseFloat(m[1].replace(",", "."));
  const amount = m[2] ? rawNum * 1000 : rawNum;
  const rest   = m[3].trim();

  for (const kw of SHORTCUT_KEYWORDS) {
    if (kw.pattern.test(rest)) {
      return { amount, transaction_type: kw.type, financial_tag: kw.tag, label: kw.label };
    }
  }
  return null;
}

// Parses a standalone amount token like "15k", "5.5k", "200" from a comma part.
function parseAmountToken(token: string): number | null {
  const m = token.trim().match(/^(\d+(?:[.,]\d+)?)(k)?$/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  return m[2] ? num * 1000 : num;
}

// ── Phase 3: Session state ────────────────────────────────────────────────────

type SessionState =
  | "AWAITING_SCOPE_SELECTION"
  | "AWAITING_CANCEL_CONFIRMATION"
  | "AWAITING_WORKSPACE_SWITCH"
  | "AWAITING_TAG_SELECTION";

// Serialised inside user_sessions.context_json for AWAITING_SCOPE_SELECTION.
interface PendingTransactionContext {
  amount:           number;
  transaction_type: TransactionType;
  financial_tag:    FinancialTag;
  description:      string;
  raw_text:         string;
}

// Serialised inside user_sessions.context_json for AWAITING_WORKSPACE_SWITCH.
interface PendingWorkspaceSwitchContext {
  transactionId: string;
}

// Serialised inside user_sessions.context_json for AWAITING_TAG_SELECTION.
interface PendingTagSelectionContext {
  amount:              number;
  transaction_type:    TransactionType;
  description:         string;
  entity_prefix_guess: string | null;
  project_name:        string | null;
  raw_text:            string;
}

interface UserSession {
  current_state: SessionState;
  context_json:  string | null;
}

// Typed result returned by handleSessionState.
// "reply"  → return this message to the user immediately, pipeline stops.
// "route"  → resume the pipeline with these pre-filled values, skip the AI call.
// "defer"  → session cleared; fall through to AI as normal.
type SessionRouteResult =
  | { kind: "reply";  message: string }
  | { kind: "route";  parsed: ParsedTransaction; businessId: string | null }
  | { kind: "defer" };

async function getSession(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string,
): Promise<UserSession | null> {
  try {
    const { data } = await supabase
      .from("user_sessions")
      .select("current_state, context_json")
      .eq("phone_number", phoneNumber)
      .not("current_state", "is", null)
      .maybeSingle() as { data: UserSession | null };
    return data ?? null;
  } catch {
    return null; // table may not exist yet
  }
}

async function saveSession(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string,
  state: SessionState,
  context: PendingTransactionContext | PendingWorkspaceSwitchContext | PendingTagSelectionContext,
): Promise<void> {
  try {
    await supabase.from("user_sessions").upsert(
      {
        phone_number:  phoneNumber,
        current_state: state,
        context_json:  JSON.stringify(context),
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    );
  } catch (e) {
    console.error("[session] saveSession failed:", e);
  }
}

async function clearSession(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string,
): Promise<void> {
  try {
    await supabase
      .from("user_sessions")
      .update({ current_state: null, context_json: null, updated_at: new Date().toISOString() })
      .eq("phone_number", phoneNumber);
  } catch { /* non-fatal */ }
}

async function handleSessionState(
  supabase: ReturnType<typeof createClient>,
  from: string,
  rawText: string,
  session: UserSession,
  businesses: BusinessRow[],
): Promise<SessionRouteResult> {
  // ── AWAITING_SCOPE_SELECTION ─────────────────────────────────────────────
  // User was shown an ambiguity prompt. Their reply should be "personal",
  // "1", or an exact/partial business name. Button clicks arrive via Phase 1
  // and call resolveSessionWithBusiness() directly — this branch handles
  // plain-text replies.
  if (session.current_state === "AWAITING_SCOPE_SELECTION") {
    const ctx = (() => {
      try {
        return session.context_json
          ? JSON.parse(session.context_json) as PendingTransactionContext
          : null;
      } catch { return null; }
    })();

    if (!ctx) {
      console.log("[session] AWAITING_SCOPE_SELECTION — no context stored, deferring to AI");
      await clearSession(supabase, from);
      return { kind: "defer" };
    }

    const t = rawText.trim().toLowerCase();
    let resolvedBusinessId: string | null = null;
    let matched = false;

    // "personal", "👤", or "1" → Personal Ledger
    if (/^(personal|1|👤|personal ledger)$/i.test(t)) {
      resolvedBusinessId = null;
      matched = true;
      console.log("[session] AWAITING_SCOPE_SELECTION → Personal Ledger");
    } else {
      // Try to match against a known business name (partial or exact).
      const bizMatch = businesses.find(
        (b) =>
          b.name.toLowerCase().includes(t) ||
          t.includes(b.name.toLowerCase()),
      );
      if (bizMatch) {
        resolvedBusinessId = bizMatch.id;
        matched = true;
        console.log(`[session] AWAITING_SCOPE_SELECTION → business "${bizMatch.name}"`);
      }
    }

    if (!matched) {
      // Unrecognised reply — keep the session alive and re-prompt once.
      console.log("[session] AWAITING_SCOPE_SELECTION — unrecognised reply, re-prompting");
      const bizLines = businesses.map((b) => `• ${b.name}`).join("\n");
      return {
        kind: "reply",
        message: [
          "❓ I didn't recognise that business or project. Please reply with:",
          "",
          '• "personal" — Personal Ledger',
          bizLines,
          "",
          "Or just type the business name exactly as listed above.",
        ].join("\n"),
      };
    }

    await clearSession(supabase, from);

    const syntheticParsed: ParsedTransaction = {
      amount:                ctx.amount,
      transaction_type:      ctx.transaction_type,
      financial_tag:         ctx.financial_tag,
      description:           ctx.description,
      entity_prefix_guess:   null,
      project_name:          null,
      is_corporate_ambiguous: false,
      is_valid_transaction:  true,
    };

    return { kind: "route", parsed: syntheticParsed, businessId: resolvedBusinessId };
  }

  // ── AWAITING_WORKSPACE_SWITCH ────────────────────────────────────────────
  if (session.current_state === "AWAITING_WORKSPACE_SWITCH") {
    const ctx = (() => {
      try { return session.context_json ? JSON.parse(session.context_json) as PendingWorkspaceSwitchContext : null; }
      catch { return null; }
    })();

    if (!ctx?.transactionId) {
      await clearSession(supabase, from);
      return { kind: "reply", message: "⚠️ Session context lost. Please resend your original message." };
    }

    const t = rawText.trim();
    let chosenBizId: string | null = null;
    let chosenName = "Personal Ledger";

    const numMatch = t.match(/^(\d+)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      if (idx > 0 && idx <= businesses.length) {
        const biz = businesses[idx - 1];
        chosenBizId = biz.id;
        chosenName  = biz.name;
      }
      // idx === 0 → Personal Ledger (defaults remain null)
    } else {
      const lower = t.toLowerCase();
      if (!/^(personal|👤|personal\s+ledger)$/i.test(lower)) {
        const match = businesses.find(
          (b) => b.name.toLowerCase().includes(lower) || lower.includes(b.name.toLowerCase()),
        );
        if (match) {
          chosenBizId = match.id;
          chosenName  = match.name;
        } else {
          return { kind: "reply", message: `❓ I didn't recognise "${t}". Please reply with a number from the list.` };
        }
      }
    }

    const { error: updateErr } = await supabase
      .from("transactions")
      .update({ business_id: chosenBizId })
      .eq("id", ctx.transactionId) as { error: { message: string } | null };

    await clearSession(supabase, from);

    if (updateErr) {
      console.error("[session/workspace_switch] update failed:", updateErr.message);
      return { kind: "reply", message: `❌ Could not move transaction: ${updateErr.message}` };
    }

    console.log(`[session/workspace_switch] tx ${ctx.transactionId} → ${chosenName}`);
    return { kind: "reply", message: `✅ Transaction moved to *${chosenName}*!` };
  }

  // ── AWAITING_TAG_SELECTION ───────────────────────────────────────────────
  // Triggered after is_tag_ambiguous; user may reply with a number or name.
  // List-item clicks arrive in Phase 1 (tag_select action) and bypass this branch.
  if (session.current_state === "AWAITING_TAG_SELECTION") {
    const ctx = (() => {
      try { return session.context_json ? JSON.parse(session.context_json) as PendingTagSelectionContext : null; }
      catch { return null; }
    })();

    if (!ctx) {
      await clearSession(supabase, from);
      return { kind: "reply", message: "⚠️ Session context lost. Please resend your original message." };
    }

    const t = rawText.trim().toLowerCase();
    const TAG_MAP: Record<string, FinancialTag> = {
      "1": "revenue",    "sales": "revenue",    "income": "revenue",
      "2": "cogs",       "stock": "cogs",        "materials": "cogs",
      "3": "opex",       "daily": "opex",        "running": "opex",
      "4": "fixed_cost", "monthly": "fixed_cost","overheads": "fixed_cost",
      "5": "capex",      "equipment": "capex",   "assets": "capex",
    };
    const chosenTag: FinancialTag | undefined = TAG_MAP[t];

    if (!chosenTag) {
      return {
        kind: "reply",
        message: "❓ Please reply with a number (1–5) or a keyword like \"stock\", \"equipment\", or \"income\".",
      };
    }

    await clearSession(supabase, from);

    let resolvedBizId: string | null = null;
    if (ctx.entity_prefix_guess && businesses.length) {
      const guess = ctx.entity_prefix_guess.toLowerCase();
      const match = businesses.find(
        (b) => b.name.toLowerCase().includes(guess) || guess.includes(b.name.toLowerCase()),
      );
      if (match) resolvedBizId = match.id;
    }

    return {
      kind: "route",
      parsed: {
        amount:                ctx.amount,
        transaction_type:      ctx.transaction_type,
        financial_tag:         chosenTag,
        description:           ctx.description,
        entity_prefix_guess:   ctx.entity_prefix_guess,
        project_name:          ctx.project_name,
        is_corporate_ambiguous: false,
        is_tag_ambiguous:      false,
        is_valid_transaction:  true,
      },
      businessId: resolvedBizId,
    };
  }

  // ── AWAITING_CANCEL_CONFIRMATION ─────────────────────────────────────────
  if (session.current_state === "AWAITING_CANCEL_CONFIRMATION") {
    await clearSession(supabase, from);
    return { kind: "defer" };
  }

  await clearSession(supabase, from);
  return { kind: "defer" };
}

// Resolves a pending scope-selection session triggered by a button click.
// Returns the same SessionRouteResult shape so the call site is uniform.
async function resolveSessionWithBusiness(
  supabase: ReturnType<typeof createClient>,
  from: string,
  businessId: string | null,
): Promise<SessionRouteResult> {
  const session = await getSession(supabase, from);

  if (!session || session.current_state !== "AWAITING_SCOPE_SELECTION") {
    console.log("[session/button] No active AWAITING_SCOPE_SELECTION session for", from);
    return { kind: "reply", message: "⚠️ No pending transaction found. Please resend your original message." };
  }

  const ctx = (() => {
    try {
      return session.context_json
        ? JSON.parse(session.context_json) as PendingTransactionContext
        : null;
    } catch { return null; }
  })();

  if (!ctx) {
    await clearSession(supabase, from);
    return { kind: "reply", message: "⚠️ Session context lost. Please resend your original message." };
  }

  await clearSession(supabase, from);
  console.log(`[session/button] Resolved scope: businessId=${businessId ?? "Personal Ledger"}`);

  return {
    kind: "route",
    parsed: {
      amount:                ctx.amount,
      transaction_type:      ctx.transaction_type,
      financial_tag:         ctx.financial_tag,
      description:           ctx.description,
      entity_prefix_guess:   null,
      project_name:          null,
      is_corporate_ambiguous: false,
      is_valid_transaction:  true,
    },
    businessId,
  };
}

// ── System instructions ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION_TEXT = `
You are a world-class accounting assistant for Nigerian SMEs — retailers, traders,
manufacturers, contractors, and service businesses.

Analyze the conversational WhatsApp message and return a JSON object with
exactly these fields:

  amount                 number         Monetary value in NGN (strip ₦ symbols and commas)
  transaction_type       string         "inflow" or "outflow"
  financial_tag          string         One of: "revenue" | "cogs" | "opex" | "fixed_cost" | "capex" | "personal_essential" | "personal_luxury"
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
  is_tag_ambiguous       boolean        Set to true ONLY when you genuinely cannot determine the correct
                                        financial_tag from the message — e.g. a purchase that could
                                        equally be opex, cogs, or capex and the message gives no clear
                                        signals. Set to false whenever you can confidently classify.
  is_valid_transaction   boolean        true if the message describes any financial transaction with a
                                        discernible monetary amount. Set to false when the message is a
                                        greeting, a single word, a question, chitchat, or any text that
                                        does not contain an amount and a financial event.

Tag selection rules (Nigerian SME context):
  revenue       → money received for services, sales, or client payments (always inflow)
  cogs          → buying inventory for resale, clearing or importing goods, purchasing raw
                  materials or direct production inputs (e.g. fabric, cement, foodstuff wholesale,
                  spare parts stock, goods for market). Always outflow.
  capex         → acquiring long-term business assets that will be used repeatedly:
                  generators, industrial machinery, vehicles, laptops, heavy tools, shop
                  fit-outs, or any durable equipment. Always outflow.
  opex          → day-to-day variable business running costs: generator fuel for operations,
                  business transport/logistics, data/airtime, advertising, courier, packaging,
                  casual labour, minor repairs. Always outflow.
  fixed_cost    → recurring monthly overheads that are predictable: shop or office rent,
                  permanent staff salaries, monthly utility bills, recurring retainer fees,
                  subscription services. Always outflow.
  personal_essential → personal necessities — food, personal transport, healthcare,
                  household utilities, school fees, personal airtime. Always outflow.
  personal_luxury    → personal discretionary spending — dining out, entertainment,
                  fashion, holidays, gifts. Always outflow.

IMPORTANT: When is_corporate_ambiguous is true, still populate amount, transaction_type,
financial_tag, and description with your best guess — these will be used if the user
confirms a workspace. Set entity_prefix_guess to null.

When is_valid_transaction is false, you may set amount to 0 and leave other fields as
reasonable defaults — they will be ignored.

Return only the JSON object. No explanation, no markdown fencing.
`.trim();

const SYSTEM_INSTRUCTION_RECEIPT = `
You are a world-class accounting assistant for Nigerian SMEs — retailers, traders,
manufacturers, contractors, and service businesses.

You will receive a receipt or invoice image. Extract all relevant financial
details and return a JSON object with exactly these fields:

  amount                 number         Grand total paid in NGN (strip ₦ symbols and commas)
  transaction_type       string         Always "outflow" for a receipt/purchase
  financial_tag          string         One of: "revenue" | "cogs" | "opex" | "fixed_cost" | "capex" | "personal_essential" | "personal_luxury"
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
  is_tag_ambiguous       boolean        Set to true ONLY when the receipt items make it genuinely
                                        unclear whether to use cogs, opex, capex, or fixed_cost — e.g.
                                        a mixed receipt with both consumables and durable goods. Set to
                                        false when the category is clear from the items.
  is_valid_transaction   boolean        true if the image is a recognisable receipt, invoice, or financial
                                        document with a legible total amount. Set to false if the image is
                                        a selfie, screenshot of a chat, blank image, or otherwise contains
                                        no extractable financial data.

Tag selection rules (Nigerian SME context):
  cogs          → purchased goods for resale, cleared/imported goods, raw production materials
                  (fabric, cement, foodstuff wholesale, spare parts stock, goods for market)
  capex         → durable long-term assets: generators, machinery, vehicles, laptops, heavy
                  tools, industrial equipment, shop/office fit-outs
  opex          → day-to-day running costs: fuel, business transport, data, advertising,
                  packaging, courier, minor repairs, casual labour
  fixed_cost    → recurring monthly overheads: rent, permanent staff salaries, recurring
                  utility bills, monthly subscription invoices
  personal_essential → groceries, pharmacy, household utilities, personal transport
  personal_luxury    → restaurants, bars, entertainment, fashion, electronics for personal use

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

// Retries once on transient Gemini overload (503) or rate-limit (429).
// Delay is capped at 400 ms to stay well inside Twilio's 15-second limit.
async function geminiPost(
  label: string,
  body: unknown,
  maxRetries = 1,
): Promise<Response> {
  const RETRYABLE = new Set([429, 503]);
  const MAX_DELAY_MS = 400;
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

    const delay = Math.min(200 * Math.pow(2, attempt), MAX_DELAY_MS);
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
  buttonPayload: string | null,
): Promise<string | { kind: "committed"; text: string; transactionId: string } | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Populated by Phase 1 or Phase 2 to skip the AI call entirely.
  let shortcutParsed: ParsedTransaction | null = null;
  let overrideBusinessId: string | null | undefined = undefined; // undefined = "not set by router"

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
    return "Setup incomplete. Please create your first business on the web dashboard before texting Cash Bot.";
  }

  // ── Phase 1: Interactive button dispatch ─────────────────────────────────
  if (buttonPayload) {
    console.log(`[router/P1] button payload: "${buttonPayload}"`);
    const action = parseButtonPayload(buttonPayload);
    if (action) {
      if (action.kind === "cancel_last") {
        console.log("[router/P1] → cancel_last");
        return await handleCancelCommand(supabase, from);
      }
      // Scope-selection buttons: load pending tx from session + commit.
      if (action.kind === "select_scope_personal" || action.kind === "select_scope_biz") {
        const targetBizId = action.kind === "select_scope_biz" ? action.businessId : null;
        console.log(`[router/P1] → ${action.kind}, businessId=${targetBizId ?? "Personal Ledger"}`);
        const result = await resolveSessionWithBusiness(supabase, from, targetBizId);
        if (result.kind === "reply") return result.message;
        if (result.kind === "route") {
          shortcutParsed    = result.parsed;
          overrideBusinessId = result.businessId;
        }
        // "defer" falls through to AI
      } else if (action.kind === "confirm_personal") {
        console.log("[router/P1] → confirm_personal");
        shortcutParsed = {
          amount: action.amount,
          transaction_type: "outflow",
          financial_tag: action.tag,
          description: action.description,
          entity_prefix_guess: null,
          project_name: null,
          is_corporate_ambiguous: false,
          is_valid_transaction: true,
        };
        overrideBusinessId = null;
      } else if (action.kind === "confirm_business") {
        console.log("[router/P1] → confirm_business:", action.businessId);
        shortcutParsed = {
          amount: action.amount,
          transaction_type: "outflow",
          financial_tag: action.tag,
          description: action.description,
          entity_prefix_guess: null,
          project_name: null,
          is_corporate_ambiguous: false,
          is_valid_transaction: true,
        };
        overrideBusinessId = action.businessId;
      } else if (action.kind === "tag_select") {
        console.log(`[router/P1] → tag_select: ${action.tag}`);
        const session = await getSession(supabase, from);
        if (!session || session.current_state !== "AWAITING_TAG_SELECTION") {
          return "⚠️ No pending transaction found. Please resend your original message.";
        }
        const ctx = (() => {
          try { return session.context_json ? JSON.parse(session.context_json) as PendingTagSelectionContext : null; }
          catch { return null; }
        })();
        if (!ctx) {
          await clearSession(supabase, from);
          return "⚠️ Session context lost. Please resend your original message.";
        }
        await clearSession(supabase, from);

        // Resolve businessId from entity_prefix_guess if present
        let tagBizId: string | null = null;
        if (ctx.entity_prefix_guess && businesses?.length) {
          const guess = ctx.entity_prefix_guess.toLowerCase();
          const match = businesses.find(
            (b) => b.name.toLowerCase().includes(guess) || guess.includes(b.name.toLowerCase()),
          );
          if (match) tagBizId = match.id;
        }

        shortcutParsed = {
          amount:                ctx.amount,
          transaction_type:      ctx.transaction_type,
          financial_tag:         action.tag,
          description:           ctx.description,
          entity_prefix_guess:   ctx.entity_prefix_guess,
          project_name:          ctx.project_name,
          is_corporate_ambiguous: false,
          is_tag_ambiguous:      false,
          is_valid_transaction:  true,
        };
        overrideBusinessId = tagBizId;

      } else if (action.kind === "change_workspace") {
        console.log(`[router/P1] → change_workspace, txId=${action.transactionId}`);
        const wsLines = [
          "🔁 Which business or project should this transaction be moved to?",
          "",
          "1. 👤 Personal Ledger",
          ...(businesses ?? []).map((b, i) => `${i + 2}. 💼 ${b.name}`),
          "",
          "Reply with the number or name.",
        ];
        await saveSession(supabase, from, "AWAITING_WORKSPACE_SWITCH", {
          transactionId: action.transactionId,
        });
        return wsLines.join("\n");
      }
    } else {
      console.log("[router/P1] unrecognised payload — falling through");
    }
  }

  // ── Phase 2: 3-Tier shorthand + dot protocol ────────────────────────────
  // Delimiter is a period/dot (.) so commas can appear freely inside amounts
  // like "15,000" without breaking the parser.
  // Only a dot that is NOT between two digits is treated as a separator —
  // this keeps decimal amounts like "15.5k" in Tier 1 where they belong.
  if (!shortcutParsed && !mediaUrl) {
    const trimmedText = rawText.trim();
    const hasDot      = /(?<!\d)\.(?!\d)/.test(trimmedText);

    if (hasDot) {
      // ── Tier 2: Dot Protocol ────────────────────────────────────────────────
      // Split on any dot that is not flanked by digits on both sides,
      // trimming surrounding whitespace so "15k . fuel" and "15k.fuel" both work.
      const parts  = trimmedText.split(/\s*(?<!\d)\.(?!\d)\s*/);
      const amount = parseAmountToken(parts[0] ?? "");

      if (amount !== null && amount > 0 && parts.length >= 2) {
        const description = (parts[1] ?? "").trim();

        if (parts.length === 2) {
          // 2-part: explicit Personal Ledger
          console.log("[router/P2/T2] 2-part dot →", { amount, description });
          shortcutParsed = {
            amount,
            transaction_type:      "outflow",
            financial_tag:         "personal_essential",
            description,
            entity_prefix_guess:   null,
            project_name:          null,
            is_corporate_ambiguous: false,
            is_valid_transaction:  true,
          };
          overrideBusinessId = null; // explicit Personal Ledger

        } else {
          // 3-part: parallel DB lookup for scope
          const scopeHint = (parts[2] ?? "").trim().toLowerCase();
          console.log("[router/P2/T2] 3-part dot →", { amount, description, scopeHint });

          const [bizResult, projResult] = await Promise.all([
            supabase
              .from("businesses")
              .select("id, name")
              .ilike("name", `%${scopeHint}%`)
              .limit(3) as Promise<{ data: { id: string; name: string }[] | null; error: unknown }>,
            supabase
              .from("projects")
              .select("id, name, business_id")
              .ilike("name", `%${scopeHint}%`)
              .limit(3) as Promise<{ data: { id: string; name: string; business_id: string }[] | null; error: unknown }>,
          ]);

          if (bizResult.error)  console.error("[router/P2/T2] business lookup error:", bizResult.error);
          if (projResult.error) console.error("[router/P2/T2] project lookup error:", projResult.error);

          const bizMatch  = bizResult.data?.[0]  ?? null;
          const projMatch = projResult.data?.[0] ?? null;

          let t2ProjectName: string | null = null;

          if (bizMatch) {
            overrideBusinessId = bizMatch.id;
            console.log(`[router/P2/T2] business match → "${bizMatch.name}" (${bizMatch.id})`);
          } else if (projMatch) {
            overrideBusinessId = projMatch.business_id;
            t2ProjectName      = projMatch.name;
            console.log(`[router/P2/T2] project match → "${projMatch.name}" (biz ${projMatch.business_id})`);
          } else {
            // No match — default to Personal Ledger
            overrideBusinessId = null;
            console.log(`[router/P2/T2] no DB match for "${scopeHint}" — defaulting to Personal Ledger`);
          }

          shortcutParsed = {
            amount,
            transaction_type:      "outflow",
            financial_tag:         "opex",
            description,
            entity_prefix_guess:   null,
            project_name:          t2ProjectName,
            is_corporate_ambiguous: false,
            is_valid_transaction:  true,
          };
        }
      }
      // amount unparseable → fall through to Phase 3/4

    } else {
      // ── Tier 1: Simple shorthand (no dot separator) ────────────────────────
      const sc = matchShortcut(trimmedText);
      if (sc) {
        console.log("[router/P2/T1] shorthand match:", { amount: sc.amount, label: sc.label });
        shortcutParsed = {
          amount:                sc.amount,
          transaction_type:      sc.transaction_type,
          financial_tag:         sc.financial_tag,
          description:           sc.label,
          entity_prefix_guess:   null,
          project_name:          null,
          is_corporate_ambiguous: false,
          is_valid_transaction:  true,
        };
        overrideBusinessId = null; // explicit Personal Ledger
      }
      // no match → Tier 3 (falls through to Phase 3 session check then Phase 4 Gemini)
    }
  }

  // ── Phase 3: Session state ────────────────────────────────────────────────
  if (!shortcutParsed) {
    const session = await getSession(supabase, from);
    if (session) {
      console.log(`[router/P3] session state: ${session.current_state}`);
      const result = await handleSessionState(supabase, from, rawText, session, businesses ?? []);
      if (result.kind === "reply")  return result.message;
      if (result.kind === "route") {
        shortcutParsed    = result.parsed;
        overrideBusinessId = result.businessId;
        console.log("[router/P3] session resolved — resuming pipeline with pre-filled route");
      } else {
        console.log("[router/P3] session deferred — proceeding to AI");
      }
    }
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

  // ── Step D: AI semantic extraction (Phase 4 fallback) ────────────────────
  let parsed: ParsedTransaction;

  if (shortcutParsed) {
    // Phase 1 or 2 already extracted — skip Gemini entirely.
    parsed = shortcutParsed;
    console.log("[router/P4] AI bypassed — using pre-parsed result");
  } else {
    try {
      if (imageBuffer) {
        parsed = await extractFromImage(rawText, imageBuffer, imageMimeType);
        console.log("[router/P4] Gemini vision parsed:", parsed);
      } else {
        parsed = await extractFromText(rawText);
        console.log("[router/P4] Gemini text parsed:", parsed);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[router/P4] Gemini call failed:", detail);
      return "⚠️ CashBot is experiencing high traffic right now. Please try logging that transaction again in a moment!";
    }
  }

  // ── Step D2: Invalid transaction intercept ────────────────────────────────
  if (!parsed.is_valid_transaction) {
    console.log("[pipeline] No valid transaction detected — returning guidance");
    return [
      "ℹ️ I couldn't find a transaction amount in that message.",
      "",
      "To log an expense, please resend the full sentence including the amount and business or project.",
      `Example: "Spent 55k on transportation for Favsys"`,
    ].join("\n");
  }

  // ── Step E: Ambiguity intercept (CITA WREN enforcement) ─────────────────
  // CITA s.27 WREN test: an outflow is deductible only when it is Wholly,
  // Revenue-in-nature, Exclusive to the business, and Necessary. Dual-use
  // categories — fuel, transport, data, utilities, meals — fail this test
  // unless attributed to a specific workspace. Gemini sets
  // is_corporate_ambiguous=true for these, and we gate them here so every
  // ambiguous outflow gets an explicit workspace before it enters the ledger.
  // Skip when a project name was stated — Step F2 will resolve the business.
  if (parsed.is_corporate_ambiguous && !parsed.entity_prefix_guess && !parsed.project_name) {
    console.log("[pipeline] Dual-use / corporate ambiguity — saving session + requesting scope");

    // Persist the parsed context so Phase 3 or a button reply can resume later.
    await saveSession(supabase, from, "AWAITING_SCOPE_SELECTION", {
      amount:           parsed.amount,
      transaction_type: parsed.transaction_type,
      financial_tag:    parsed.financial_tag,
      description:      parsed.description,
      raw_text:         rawText,
    });

    const bizLines = businesses?.map((b, i) => `${i + 2}. 💼 ${b.name}`).join("\n") ?? "";

    return [
      `🤔 *Which business or project should I log this under?*`,
      "",
      `💰 ${fmtNGN(parsed.amount)} — ${parsed.description}`,
      "",
      "Reply with a number or name:",
      "1. 👤 Personal Ledger",
      bizLines,
      "",
      "Or just type the business name.",
      "",
      "_(Your transaction is saved — reply any time today to confirm.)_",
    ].join("\n");
  }

  // ── Step F: Context routing ───────────────────────────────────────────────
  // overrideBusinessId set by Phase 1 (button confirm): null = Personal Ledger,
  // a UUID = that business, undefined = "not specified, use entity_prefix_guess".
  let businessId: string | null = overrideBusinessId !== undefined ? overrideBusinessId : null;

  if (overrideBusinessId !== undefined) {
    console.log(`[router/P1] business override: ${overrideBusinessId ?? "Personal Ledger"}`);
  } else if (parsed.entity_prefix_guess && businesses?.length) {
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
  } else if (overrideBusinessId === undefined) {
    console.log("[pipeline] No entity hint — routing to Personal Ledger");
  }

  // ── Step F2: Project resolution ───────────────────────────────────────────
  // Projects are scoped to a business. When businessId is null (Personal
  // Ledger) we skip silently — the schema requires a non-null business_id
  // on the projects table.
  let projectId: string | null = null;
  let resolvedProjectName: string | null = null;
  let projectLinkFailed = false;   // set when DB write succeeded but project could not be linked
  let bizInferredFromProject = false;

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
    // Step 1: exact case-insensitive match.
    const { data: exactMatches } = await supabase
      .from("projects")
      .select("id, name, business_id")
      .ilike("name", rawProjectName) as {
        data: { id: string; name: string; business_id: string }[] | null;
      };

    let crossMatches = exactMatches;

    // Step 2: fuzzy fallback — strip generic suffixes ("Project", "Phase", etc.)
    // and match on the remaining significant words.
    if (!crossMatches?.length) {
      const STOP = new Set(["project", "phase", "stage", "initiative", "program", "task", "job", "work", "the"]);
      const sigWords = rawProjectName
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));

      if (sigWords.length > 0) {
        const orFilter = sigWords.map((w) => `name.ilike.%${w}%`).join(",");
        const { data: fuzzyMatches } = await supabase
          .from("projects")
          .select("id, name, business_id")
          .or(orFilter) as {
            data: { id: string; name: string; business_id: string }[] | null;
          };
        if (fuzzyMatches?.length) {
          console.log(`[pipeline] Fuzzy project match for "${rawProjectName}":`, fuzzyMatches.map((p) => p.name));
          crossMatches = fuzzyMatches;
        }
      }
    }

    if (crossMatches && crossMatches.length === 1) {
      projectId = crossMatches[0].id;
      resolvedProjectName = crossMatches[0].name;
      businessId = crossMatches[0].business_id;
      bizInferredFromProject = true;
      console.log(`[pipeline] Project "${resolvedProjectName}" → inferred business ${businessId}`);
    } else if (crossMatches && crossMatches.length > 1) {
      // Deduplicate by business — only ask for clarification if truly ambiguous across businesses.
      const uniqueBizIds = [...new Set(crossMatches.map((p) => p.business_id))];
      if (uniqueBizIds.length === 1) {
        // All matches are in the same business — pick the closest name.
        const best = crossMatches[0];
        projectId = best.id;
        resolvedProjectName = best.name;
        businessId = best.business_id;
        bizInferredFromProject = true;
        console.log(`[pipeline] Multiple matches, same business — using "${best.name}" → ${businessId}`);
      } else {
        const bizNames = uniqueBizIds
          .map((id) => businesses?.find((b) => b.id === id)?.name)
          .filter(Boolean) as string[];
        const exampleBiz = bizNames[0] ?? "My Business";
        return [
          `🤔 I found "${rawProjectName}" in multiple businesses:`,
          "",
          ...bizNames.map((n) => `• ${n}`),
          "",
          "Please resend and specify which one:",
          `Example: "Spent 50k on design for ${rawProjectName} — ${exampleBiz}"`,
        ].join("\n");
      }
    } else {
      console.log(`[pipeline] Project "${rawProjectName}" not found in any business — routing to Personal Ledger`);
    }
  }

  // ── Step F2.5: Project tax settings ──────────────────────────────────────
  // VAT and WHT tracking live entirely at the project level.
  let projectTax: ProjectTaxConfig | null = null;

  if (parsed.transaction_type === "inflow" && projectId) {
    const { data: pt, error: ptErr } = await supabase
      .from("projects")
      .select("track_vat, track_wht, wht_rate_percent")
      .eq("id", projectId)
      .maybeSingle() as {
        data: ProjectTaxConfig | null;
        error: { message: string } | null;
      };

    if (ptErr) {
      console.error("[pipeline] Project tax fetch failed:", ptErr.message);
    } else if (pt) {
      projectTax = pt;
      console.log(`[pipeline] Project tax config (${projectId}):`, pt);
    }
  }

  const effectiveTax: EffectiveTaxConfig | null = projectTax
    ? {
        enable_vat: projectTax.track_vat,
        vat_rate:   7.5, // Nigerian statutory rate — Finance Act 2019
        enable_wht: projectTax.track_wht,
        wht_rate:   projectTax.wht_rate_percent,
      }
    : null;

  const taxBreakdown: TaxBreakdown | null =
    effectiveTax && (effectiveTax.enable_vat || effectiveTax.enable_wht)
      ? computeTaxBreakdown(parsed.amount, effectiveTax)
      : null;

  // ── Step G: Database ingestion ────────────────────────────────────────────
  const { data: insertedTx, error: insertErr } = await supabase
    .from("transactions")
    .insert({
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
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

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

  let workspaceName: string;
  if (!businessId) {
    workspaceName = "Personal Ledger";
  } else {
    workspaceName = businesses?.find((b) => b.id === businessId)?.name ?? "";
    if (!workspaceName) {
      // Fallback: direct lookup (covers case where businessId was inferred from project)
      const { data: bizRow } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .maybeSingle() as { data: { name: string } | null };
      workspaceName = bizRow?.name ?? "Business";
    }
  }

  const lines = [
    "✅ Transaction Logged!",
    "",
    `💰 Amount: ${fmtNGN(parsed.amount)}`,
    `🏷️  Tag: ${parsed.financial_tag}`,
    `🏢 Business: ${workspaceName}`,
  ];

  if (bizInferredFromProject) {
    lines.push(`   ↳ Business auto-detected from project name`);
  }
  if (resolvedProjectName) {
    lines.push(`📂 Project: ${resolvedProjectName}`);
  } else if (projectLinkFailed && rawProjectName) {
    lines.push(`⚠️  Project: Could not link to "${rawProjectName}" — saved as Unassigned`);
  }
  lines.push(`📝 ${parsed.description}`);

  // ── Tax compliance breakdown (project-level inflow) ───────────────────────
  if (taxBreakdown) {
    const { vat_enabled, wht_enabled, wht_rate } = taxBreakdown;

    if (vat_enabled && !wht_enabled) {
      // VAT-only: client pays VAT-inclusive; vendor splits and remits to FIRS.
      lines.push(
        "",
        "🧾 *VAT Compliance Breakdown*",
        `   True Revenue (ex-VAT):  ${fmtNGN(taxBreakdown.core_revenue)}`,
        `   VAT Collected (${taxBreakdown.vat_rate}%):   ${fmtNGN(taxBreakdown.tax_vat_amount)}`,
        `   → Remit VAT to FIRS via TaxPro-Max`,
      );
    } else if (wht_enabled && !vat_enabled) {
      // WHT-only: client deducts before paying; vendor tracks credit note for TCC.
      lines.push(
        "",
        "🏦 *WHT Compliance Breakdown*",
        `   Gross Invoice Value:    ${fmtNGN(taxBreakdown.gross_amount)}`,
        `   WHT Deducted (${wht_rate}%):  -${fmtNGN(taxBreakdown.tax_wht_amount)}`,
        `   Cash at Hand:           ${fmtNGN(taxBreakdown.net_amount_received)}`,
        `   WHT Credit Note:        ${fmtNGN(taxBreakdown.tax_wht_amount)}`,
        `   → Track credit note for TCC offset at FIRS`,
      );
    } else if (vat_enabled && wht_enabled) {
      // Both apply: VAT splits core revenue, then WHT is also withheld.
      lines.push(
        "",
        "🧾 *Tax Compliance Breakdown*",
        `   Gross Invoice Value:    ${fmtNGN(taxBreakdown.gross_amount)}`,
        `   True Revenue (ex-VAT):  ${fmtNGN(taxBreakdown.core_revenue)}`,
        `   VAT Collected (${taxBreakdown.vat_rate}%):   ${fmtNGN(taxBreakdown.tax_vat_amount)}`,
        `   WHT Deducted (${wht_rate}%):  -${fmtNGN(taxBreakdown.tax_wht_amount)}`,
        `   Cash at Hand:           ${fmtNGN(taxBreakdown.net_amount_received)}`,
        `   → Remit VAT to FIRS · WHT Credit: ${fmtNGN(taxBreakdown.tax_wht_amount)}`,
      );
    }
  }

  const activeTaxonomy = businessId === null ? PERSONAL_TAXONOMY : BUSINESS_TAXONOMY;
  const taxonomyLines = Object.entries(activeTaxonomy)
    .map(([, entry]) => `${entry.emoji} ${entry.label}`);

  lines.push(
    "",
    "───",
    "Incorrect category? Reply with a number to change it:",
    ...taxonomyLines,
  );

  const txId = insertedTx?.id;
  return txId ? { kind: "committed", text: lines.join("\n"), transactionId: txId } : lines.join("\n");
}

// ── Taxonomy maps ─────────────────────────────────────────────────────────────
// Two separate sets so the digit interceptor and message builder can serve
// the correct options depending on whether the last transaction is personal
// or belongs to a business.

interface TaxonomyEntry {
  tag:              FinancialTag;
  label:            string;
  transaction_type: TransactionType;
  emoji:            string;
}

const BUSINESS_TAXONOMY: Record<string, TaxonomyEntry> = {
  "1": { tag: "revenue",    label: "Sales & Income",      transaction_type: "inflow",  emoji: "1️⃣" },
  "2": { tag: "cogs",       label: "Stock & Materials",   transaction_type: "outflow", emoji: "2️⃣" },
  "3": { tag: "opex",       label: "Daily Running Costs", transaction_type: "outflow", emoji: "3️⃣" },
  "4": { tag: "fixed_cost", label: "Monthly Overheads",   transaction_type: "outflow", emoji: "4️⃣" },
  "5": { tag: "capex",      label: "Equipment & Assets",  transaction_type: "outflow", emoji: "5️⃣" },
};

const PERSONAL_TAXONOMY: Record<string, TaxonomyEntry> = {
  "1": { tag: "personal_essential", label: "Groceries & Food",     transaction_type: "outflow", emoji: "1️⃣" },
  "2": { tag: "bills_utilities",    label: "Bills & Utilities",    transaction_type: "outflow", emoji: "2️⃣" },
  "3": { tag: "personal_luxury",    label: "Personal Luxury",      transaction_type: "outflow", emoji: "3️⃣" },
  "4": { tag: "savings_investment", label: "Savings & Investment", transaction_type: "outflow", emoji: "4️⃣" },
};

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
  const rawText: string      = (form.get("Body") as string | null) ?? "";
  const from: string         = (form.get("From") as string | null) ?? "";
  const mediaUrl: string | null    = form.get("MediaUrl0") as string | null;
  const buttonPayload: string | null = form.get("ButtonPayload") as string | null;
  const messageType: string  = (form.get("MessageType") as string | null) ?? "text";

  console.log("[whatsapp-webhook] incoming", {
    from,
    bodyPreview: rawText.slice(0, 80),
    hasMedia:    mediaUrl !== null,
    messageType,
    buttonPayload: buttonPayload ?? "(none)",
  });

  try {
    // ── Single-digit category override ─────────────────────────────────────
    // Must be checked first — before any session or pipeline logic.
    // The correct taxonomy (business vs personal) is determined by the
    // business_id on the most recent transaction for this phone number.
    const digit = rawText.trim();
    if (/^[1-5]$/.test(digit)) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: lastTx } = await supabase
        .from("transactions")
        .select("id, amount, business_id")
        .eq("phone_number", from)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string; amount: number; business_id: string | null } | null };

      if (!lastTx) {
        return twimlMessage("⚠️ No recent transaction found to update.");
      }

      const isPersonal  = lastTx.business_id === null;
      const taxonomy    = isPersonal ? PERSONAL_TAXONOMY : BUSINESS_TAXONOMY;
      const tagChoice   = taxonomy[digit];

      if (!tagChoice) {
        const maxDigit = Object.keys(taxonomy).length;
        return twimlMessage(`⚠️ Please reply with a number between 1 and ${maxDigit}.`);
      }

      console.log(`[digit-override] "${digit}" → ${tagChoice.tag} (${isPersonal ? "personal" : "business"}) for ${from}`);

      // Normalise sign: inflow → positive, outflow → negative.
      const absAmount    = Math.abs(lastTx.amount);
      const signedAmount = tagChoice.transaction_type === "inflow" ? absAmount : -absAmount;

      const { error: updateErr } = await supabase
        .from("transactions")
        .update({
          financial_tag:    tagChoice.tag,
          transaction_type: tagChoice.transaction_type,
          amount:           signedAmount,
        })
        .eq("id", lastTx.id)
        .eq("phone_number", from) as { error: { message: string } | null };

      if (updateErr) {
        console.error("[digit-override] update failed:", updateErr.message);
        return twimlMessage(`❌ Could not update category: ${updateErr.message}`);
      }

      console.log(`[digit-override] ✓ tx ${lastTx.id} → ${tagChoice.tag}`);
      return twimlMessage(`✅ Category updated to ${tagChoice.label}!`);
    }

    // ── Standard pipeline ───────────────────────────────────────────────────
    const result = await runPipeline(rawText, from, mediaUrl, buttonPayload);
    if (result && typeof result === "object" && result.kind === "committed") {
      return twimlMessageWithButtons(result.text, [
        { title: "🗑️ Cancel",            payload: "CANCEL_LAST_TX"                                    },
        { title: "📝 Switch Biz/Project", payload: `change_workspace_${result.transactionId}` },
      ]);
    }
    return twimlMessage(typeof result === "string" ? result : "✅ Done.");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp-webhook] pipeline crash:", detail);
    return twimlMessage(`⚠️ CashBot Error: ${detail}`);
  }
});
