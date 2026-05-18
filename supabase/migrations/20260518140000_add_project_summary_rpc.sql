-- Per-project analytics: aggregates transactions and invoice counts
-- scoped to projects that belong to the requested business.

CREATE OR REPLACE FUNCTION get_project_summary(p_business_id UUID)
RETURNS TABLE (
  project_id    UUID,
  project_name  TEXT,
  total_inflow  NUMERIC,
  total_outflow NUMERIC,
  net_balance   NUMERIC,
  invoice_count BIGINT,
  tx_count      BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id                                                                        AS project_id,
    p.name                                                                      AS project_name,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)   AS total_inflow,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0)   AS total_outflow,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)
      - COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0) AS net_balance,
    COUNT(DISTINCT inv.id)                                                      AS invoice_count,
    COUNT(t.id)                                                                 AS tx_count
  FROM  public.projects     p
  LEFT JOIN public.transactions t   ON t.project_id  = p.id
  LEFT JOIN public.invoices     inv ON inv.project_id = p.id
  WHERE p.business_id = p_business_id
  GROUP BY p.id, p.name
  ORDER BY total_inflow DESC, net_balance DESC;
$$;
