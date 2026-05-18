-- Drop old (broken) version if it exists, then recreate with correct column names.
-- The original hand-created version referenced `type` instead of `transaction_type`.

DROP FUNCTION IF EXISTS get_weekly_business_summary(UUID);

CREATE OR REPLACE FUNCTION get_weekly_business_summary(p_business_id UUID)
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
  GROUP BY date_trunc('week', created_at)
  ORDER BY week_start DESC;
$$;
