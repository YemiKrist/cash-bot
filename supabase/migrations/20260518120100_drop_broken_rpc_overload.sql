-- Remove the original hand-crafted overload that used wrong column names
-- (`type` instead of `transaction_type`, `category` instead of `financial_tag`).
-- The correct single-argument version was applied in 20260518120000.

DROP FUNCTION IF EXISTS public.get_weekly_business_summary(
  uuid,
  timestamp without time zone
);
