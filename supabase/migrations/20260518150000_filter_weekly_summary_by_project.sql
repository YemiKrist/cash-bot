-- Replace the single-arg overload with a two-arg version that accepts an
-- optional project_id filter. When p_project_id is NULL all transactions for
-- the business are included; when set, only that project's rows are returned.

DROP FUNCTION IF EXISTS get_weekly_business_summary(UUID);

CREATE OR REPLACE FUNCTION get_weekly_business_summary(
  p_business_id UUID,
  p_project_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  week_start         DATE,
  total_inflow       NUMERIC,
  total_outflow      NUMERIC,
  net_balance        NUMERIC,
  revenue            NUMERIC,
  cogs               NUMERIC,
  opex               NUMERIC,
  personal_essential NUMERIC,
  personal_luxury    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    date_trunc('week', created_at)::DATE                                         AS week_start,
    SUM(CASE WHEN transaction_type = 'inflow'  THEN amount ELSE 0 END)           AS total_inflow,
    SUM(CASE WHEN transaction_type = 'outflow' THEN amount ELSE 0 END)           AS total_outflow,
    SUM(CASE WHEN transaction_type = 'inflow'  THEN amount ELSE -amount END)     AS net_balance,
    SUM(CASE WHEN financial_tag = 'revenue'            THEN amount ELSE 0 END)   AS revenue,
    SUM(CASE WHEN financial_tag = 'cogs'               THEN amount ELSE 0 END)   AS cogs,
    SUM(CASE WHEN financial_tag = 'opex'               THEN amount ELSE 0 END)   AS opex,
    SUM(CASE WHEN financial_tag = 'personal_essential' THEN amount ELSE 0 END)   AS personal_essential,
    SUM(CASE WHEN financial_tag = 'personal_luxury'    THEN amount ELSE 0 END)   AS personal_luxury
  FROM public.transactions
  WHERE business_id = p_business_id
    AND (p_project_id IS NULL OR project_id = p_project_id)
  GROUP BY date_trunc('week', created_at)
  ORDER BY week_start DESC;
$$;
