-- Extend get_project_summary to include an "Unassigned" row for
-- transactions whose project_id IS NULL. Named projects come first
-- (ordered by total_inflow DESC); the Unassigned row is always last
-- and only emitted when at least one unlinked transaction exists.
--
-- The UNION is wrapped in a subquery so the outer ORDER BY can use
-- a CASE expression (PostgreSQL disallows expressions in UNION ORDER BY).

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
  SELECT *
  FROM (

    -- ── Named projects ──────────────────────────────────────────────────────
    SELECT
      p.id                                                                          AS project_id,
      p.name                                                                        AS project_name,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)     AS total_inflow,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0)     AS total_outflow,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)
        - COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0) AS net_balance,
      COUNT(DISTINCT inv.id)                                                        AS invoice_count,
      COUNT(t.id)                                                                   AS tx_count
    FROM  public.projects     p
    LEFT JOIN public.transactions t   ON t.project_id  = p.id
    LEFT JOIN public.invoices     inv ON inv.project_id = p.id
    WHERE p.business_id = p_business_id
    GROUP BY p.id, p.name

    UNION ALL

    -- ── Unassigned bucket ───────────────────────────────────────────────────
    -- Only emitted when at least one transaction with no project_id exists.
    SELECT
      NULL::UUID                                                                    AS project_id,
      'Unassigned'::TEXT                                                            AS project_name,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)     AS total_inflow,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0)     AS total_outflow,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'inflow'),  0)
        - COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'outflow'), 0) AS net_balance,
      (SELECT COUNT(*) FROM public.invoices i
       WHERE i.business_id = p_business_id
         AND i.project_id  IS NULL)                                                AS invoice_count,
      COUNT(t.id)                                                                   AS tx_count
    FROM  public.transactions t
    WHERE t.business_id = p_business_id
      AND t.project_id  IS NULL
    HAVING COUNT(t.id) > 0

  ) AS combined
  ORDER BY
    CASE WHEN project_id IS NULL THEN 1 ELSE 0 END,  -- Unassigned always last
    total_inflow DESC;
$$;
