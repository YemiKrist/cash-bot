-- =============================================================================
-- Cash Bot — PostgreSQL Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- public.businesses
-- =============================================================================
CREATE TABLE public.businesses (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own businesses"
  ON public.businesses
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- public.business_invoice_settings
-- =============================================================================
CREATE TABLE public.business_invoice_settings (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID        NOT NULL UNIQUE
                                    REFERENCES public.businesses(id) ON DELETE CASCADE,
  logo_url              TEXT,
  signature_url         TEXT,
  signatory_name        TEXT,
  signatory_designation TEXT,
  color_theme_primary   TEXT        NOT NULL DEFAULT '#000000',
  color_theme_secondary TEXT        NOT NULL DEFAULT '#6B7280',
  short_note            TEXT,
  default_currency      TEXT        NOT NULL DEFAULT 'NGN',
  tax_name              TEXT        NOT NULL DEFAULT 'VAT',
  tax_percentage        NUMERIC     NOT NULL DEFAULT 7.5,
  default_shipping_fee  NUMERIC     NOT NULL DEFAULT 0.00,
  bank_details          JSONB       NOT NULL DEFAULT '[]',
  updated_at            TIMESTAMPTZ
);

ALTER TABLE public.business_invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own invoice settings"
  ON public.business_invoice_settings
  FOR ALL
  USING      (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id));

-- =============================================================================
-- public.business_fixed_rules
-- =============================================================================
CREATE TABLE public.business_fixed_rules (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL,
  -- Nullable: NULL means this is a personal (non-business) fixed cost
  business_id   UUID        REFERENCES public.businesses(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  amount        NUMERIC     NOT NULL,
  frequency     TEXT        NOT NULL
                            CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  financial_tag TEXT        NOT NULL
                            CHECK (financial_tag IN ('opex', 'personal_essential')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_fixed_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fixed rules"
  ON public.business_fixed_rules
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- public.projects
-- =============================================================================
CREATE TABLE public.projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id, name)
);

CREATE INDEX ON public.projects (business_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects"
  ON public.projects
  FOR ALL
  USING      (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id));

-- =============================================================================
-- public.invoices
-- =============================================================================
CREATE TABLE public.invoices (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID    NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  project_id     UUID    REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_number TEXT    NOT NULL,
  client_name    TEXT    NOT NULL,
  total_amount   NUMERIC NOT NULL,
  due_date       DATE,
  status         TEXT    NOT NULL DEFAULT 'unpaid'
                         CHECK (status IN ('unpaid', 'partially_paid', 'paid')),

  UNIQUE (business_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own invoices"
  ON public.invoices
  FOR ALL
  USING      (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id));

-- =============================================================================
-- public.transactions
-- =============================================================================
CREATE TABLE public.transactions (
  id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           UUID        NOT NULL,
  business_id       UUID        REFERENCES public.businesses(id) ON DELETE SET NULL,
  invoice_id        UUID        REFERENCES public.invoices(id)   ON DELETE SET NULL,
  project_id        UUID        REFERENCES public.projects(id)   ON DELETE SET NULL,
  phone_number      TEXT,
  amount            NUMERIC     NOT NULL,
  transaction_type  TEXT        NOT NULL
                                CHECK (transaction_type IN ('inflow', 'outflow')),
  financial_tag     TEXT        NOT NULL
                                CHECK (financial_tag IN (
                                  'revenue', 'cogs', 'opex',
                                  'personal_essential', 'personal_luxury'
                                )),
  description       TEXT,
  raw_text          TEXT,
  media_storage_url TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions"
  ON public.transactions
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
