-- Session state store for the WhatsApp hybrid router (Phase 3).
-- Rows are keyed by phone_number (same PK as reminder_settings).
-- current_state is nullable so clearing a session is a simple UPDATE to NULL.
CREATE TABLE IF NOT EXISTS public.user_sessions (
  phone_number   TEXT        NOT NULL PRIMARY KEY,
  current_state  TEXT,                          -- NULL = no active session
  context_json   TEXT,                          -- JSON payload from the previous turn
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
-- Service-role key bypasses RLS; no user-facing policy needed.
