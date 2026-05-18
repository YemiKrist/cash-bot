-- =============================================================================
-- Add projects as a first-class entity and migrate existing project_name data
-- =============================================================================

-- ── Step 1: Create projects table ────────────────────────────────────────────

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

-- ── Step 2: Add nullable project_id FK to invoices and transactions ───────────

ALTER TABLE public.invoices
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- ── Step 3 + 4: Backfill — promote unique project_name strings to project rows,
--   then point existing invoices at their new project_id ─────────────────────

WITH new_projects AS (
  INSERT INTO public.projects (business_id, name)
    SELECT DISTINCT business_id, project_name
    FROM   public.invoices
    WHERE  project_name IS NOT NULL
      AND  project_name <> ''
  RETURNING id, business_id, name
)
UPDATE public.invoices i
SET    project_id = np.id
FROM   new_projects np
WHERE  i.business_id = np.business_id
  AND  i.project_name = np.name;

-- ── Step 5: Propagate project_id to transactions that are linked to an invoice

UPDATE public.transactions t
SET    project_id = i.project_id
FROM   public.invoices i
WHERE  t.invoice_id = i.id
  AND  i.project_id IS NOT NULL;

-- ── Step 6: Drop the now-redundant text column ────────────────────────────────

ALTER TABLE public.invoices DROP COLUMN project_name;
