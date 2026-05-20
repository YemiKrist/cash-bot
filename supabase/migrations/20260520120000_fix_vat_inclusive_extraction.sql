-- ─────────────────────────────────────────────────────────────────────────────
-- Fix get_tax_summary: use VAT-inclusive extraction formula (Finance Act 2019)
--
-- BEFORE (wrong — additive rate, VAT-exclusive):
--   output_vat = revenue  × rate / 100          e.g. 50 000 × 7.5/100 = 3 750
--   input_vat  = expenses × rate / 100
--
-- AFTER (correct — VAT-inclusive extraction):
--   output_vat = revenue  × rate / (100 + rate)  e.g. 50 000 × 7.5/107.5 = 3 488.37
--   input_vat  = expenses × rate / (100 + rate)
--
-- Also clamps any incorrectly-stored rate (e.g. 37.5 entered instead of 7.5)
-- to the statutory 7.5 % ceiling before computation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tax_summary(
  p_business_id UUID,
  p_from        DATE DEFAULT date_trunc('quarter', CURRENT_DATE)::DATE,
  p_to          DATE DEFAULT (date_trunc('quarter', CURRENT_DATE) + INTERVAL '3 months - 1 day')::DATE
)
RETURNS TABLE (
  has_vat          BOOLEAN,
  vat_rate         NUMERIC,
  output_vat       NUMERIC,
  input_vat        NUMERIC,
  net_liability    NUMERIC,
  taxable_revenue  NUMERIC,
  taxable_expenses NUMERIC,
  invoice_count    BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_has_vat     BOOLEAN := false;
  v_rate        NUMERIC := 7.5;
  v_revenue     NUMERIC := 0;
  v_expenses    NUMERIC := 0;
  v_inv_count   BIGINT  := 0;
  v_output_vat  NUMERIC := 0;
  v_input_vat   NUMERIC := 0;
BEGIN
  -- Settings row may not exist yet for new businesses; COALESCE to defaults.
  SELECT
    COALESCE(s.has_vat,        false),
    COALESCE(s.tax_percentage, 7.5)
  INTO v_has_vat, v_rate
  FROM public.business_invoice_settings s
  WHERE s.business_id = p_business_id
  LIMIT 1;

  -- Guard against incorrectly stored rates (e.g. 37.5 instead of 7.5).
  -- Nigerian statutory VAT rate is 7.5 %; anything above 20 % is a data error.
  IF v_rate > 20 THEN
    v_rate := 7.5;
  END IF;

  -- Output side: invoices whose due_date falls in the period.
  SELECT
    COALESCE(SUM(i.total_amount), 0),
    COUNT(*)::BIGINT
  INTO v_revenue, v_inv_count
  FROM public.invoices i
  WHERE i.business_id = p_business_id
    AND i.due_date IS NOT NULL
    AND i.due_date >= p_from
    AND i.due_date <= p_to;

  -- Input side: COGS + OPEX outflows whose created_at falls in the period.
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_expenses
  FROM public.transactions t
  WHERE t.business_id = p_business_id
    AND t.transaction_type = 'outflow'
    AND t.financial_tag    IN ('cogs', 'opex')
    AND t.created_at::DATE >= p_from
    AND t.created_at::DATE <= p_to;

  -- VAT-inclusive extraction (Finance Act 2019 — 7.5 %):
  --   VAT = gross - gross / (1 + rate/100)
  --       = gross × rate / (100 + rate)
  --
  -- Verification: ₦50 000 × 7.5 / 107.5 = ₦3 488.37  ✓
  v_output_vat := ROUND(v_revenue  * v_rate / (100 + v_rate), 2);
  v_input_vat  := ROUND(v_expenses * v_rate / (100 + v_rate), 2);

  RETURN QUERY
  SELECT
    v_has_vat,
    v_rate,
    v_output_vat,
    v_input_vat,
    ROUND(v_output_vat - v_input_vat, 2),   -- positive = owed to FIRS, negative = refund
    v_revenue,
    v_expenses,
    v_inv_count;
END;
$$;
