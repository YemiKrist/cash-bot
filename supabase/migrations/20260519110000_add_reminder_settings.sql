-- ─────────────────────────────────────────────────────────────────────────────
-- reminder_settings
--
--   phone_number  PRIMARY KEY  — Twilio "From" value (whatsapp:+234...)
--   morning_hour  0–23         — hour in user's local timezone to send AM nudge
--   evening_hour  0–23         — hour in user's local timezone to send PM nudge
--   timezone                   — IANA name (default: Africa/Lagos / WAT UTC+1)
--
--   The Vercel cron job runs every hour, compares the current local hour
--   (in the user's timezone) against morning_hour / evening_hour, and fires
--   a Twilio WhatsApp message when they match.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminder_settings (
  phone_number   TEXT        PRIMARY KEY,               -- whatsapp:+234...
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled        BOOLEAN     NOT NULL DEFAULT true,
  morning_hour   INTEGER     NOT NULL DEFAULT 9
                             CHECK (morning_hour BETWEEN 0 AND 23),
  evening_hour   INTEGER     NOT NULL DEFAULT 18
                             CHECK (evening_hour BETWEEN 0 AND 23),
  timezone       TEXT        NOT NULL DEFAULT 'Africa/Lagos',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The webhook and cron both run with the service role key which bypasses RLS,
-- so we enable it without any user-facing policy for now.
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
