-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add has_vat flag to business_invoice_settings
--    tax_name and tax_percentage already exist; we only add the toggle.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.business_invoice_settings
  ADD COLUMN IF NOT EXISTS has_vat BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_tax_summary(p_business_id, p_from, p_to)
--
--    Returns one row with the estimated VAT liability for the given date window
--    (defaults to the current calendar quarter).
--
--    Output VAT  = sum of invoice total_amount in the period × rate/100
--    Input VAT   = sum of COGS + OPEX outflow transactions in the period × rate/100
--    Net         = Output − Input  (positive → owed, negative → refund)
--
--    SECURITY INVOKER: runs with the caller's RLS context, so the underlying
--    table policies on invoices, transactions, and business_invoice_settings
--    all apply automatically.  No extra ownership check needed.
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
  v_has_vat    BOOLEAN := false;
  v_rate       NUMERIC := 7.5;
  v_revenue    NUMERIC := 0;
  v_expenses   NUMERIC := 0;
  v_inv_count  BIGINT  := 0;
BEGIN
  -- Settings row may not exist yet for new businesses; COALESCE to defaults.
  SELECT
    COALESCE(s.has_vat,        false),
    COALESCE(s.tax_percentage, 7.5)
  INTO v_has_vat, v_rate
  FROM public.business_invoice_settings s
  WHERE s.business_id = p_business_id
  LIMIT 1;

  -- Output side: invoices whose due_date falls in the period.
  -- Invoices with NULL due_date are excluded (no period to assign them to).
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

  RETURN QUERY
  SELECT
    v_has_vat,
    v_rate,
    ROUND(v_revenue  * v_rate / 100, 2),
    ROUND(v_expenses * v_rate / 100, 2),
    ROUND((v_revenue - v_expenses) * v_rate / 100, 2),
    v_revenue,
    v_expenses,
    v_inv_count;
END;
$$;
