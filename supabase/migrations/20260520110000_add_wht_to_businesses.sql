-- Add WHT tracking columns to businesses so the business-level default
-- can include withholding tax, mirroring what projects already have.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS enable_wht      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wht_rate_percent numeric NOT NULL DEFAULT 5.0;
