-- FD-P0-02: atomic, same-job measurement selection.
-- Data remediation for known production cross-job pointers is intentionally
-- separate under scripts/ops and must run during the controlled cutover.

CREATE OR REPLACE FUNCTION public.jobs_validate_selected_measurement_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_measurement_company_id uuid;
  v_measurement_job_id uuid;
BEGIN
  IF NEW.selected_measurement_id IS NULL THEN
    IF TG_OP = 'INSERT'
       OR NEW.selected_measurement_id IS DISTINCT FROM OLD.selected_measurement_id THEN
      UPDATE public.measurement_records m
      SET is_selected = false,
          updated_at = now()
      WHERE m.job_id = NEW.id
        AND m.is_selected = true;
    END IF;
    RETURN NEW;
  END IF;

  SELECT m.company_id, m.job_id
    INTO v_measurement_company_id, v_measurement_job_id
  FROM public.measurement_records m
  WHERE m.id = NEW.selected_measurement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'selected_measurement_not_found'
      USING ERRCODE = '23503';
  END IF;

  IF v_measurement_company_id IS DISTINCT FROM NEW.company_id
     OR v_measurement_job_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'selected_measurement_must_belong_to_job'
      USING ERRCODE = '23514';
  END IF;

  -- Any authorized same-job pointer write must keep the row-flag representation
  -- synchronized. This closes dual-truth for raw/legacy updateJob pointer writes
  -- during the DB-first cutover window and for any residual generic job updater.
  IF TG_OP = 'INSERT'
     OR NEW.selected_measurement_id IS DISTINCT FROM OLD.selected_measurement_id THEN
    UPDATE public.measurement_records m
    SET is_selected = false,
        updated_at = now()
    WHERE m.job_id = NEW.id
      AND m.is_selected = true
      AND m.id IS DISTINCT FROM NEW.selected_measurement_id;

    UPDATE public.measurement_records m
    SET is_selected = true,
        updated_at = CASE WHEN m.is_selected THEN m.updated_at ELSE now() END
    WHERE m.id = NEW.selected_measurement_id
      AND m.is_selected IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.jobs_validate_selected_measurement_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_validate_selected_measurement_v1() TO service_role;

DROP TRIGGER IF EXISTS jobs_validate_selected_measurement_v1 ON public.jobs;
CREATE TRIGGER jobs_validate_selected_measurement_v1
BEFORE INSERT OR UPDATE OF id, company_id, selected_measurement_id ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.jobs_validate_selected_measurement_v1();

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_selected_measurement_id_fkey
  FOREIGN KEY (selected_measurement_id)
  REFERENCES public.measurement_records(id)
  ON DELETE SET NULL
  NOT VALID;

-- Intentionally NOT validated here. Production currently has known cross-job
-- selected_measurement_id rows that must be NULL-remediated first; validation
-- is performed by scripts/ops/20260910_production_measurement_pointer_remediation.sql
-- after those pointers are cleared. Staging validated cleanly because it had none.

CREATE OR REPLACE FUNCTION public.select_job_measurement_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_measurement_id uuid DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  job_id uuid,
  measurement_id uuid,
  is_selected boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_measurement public.measurement_records%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF p_company_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'company_and_job_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'company_membership_required' USING ERRCODE = '42501';
  END IF;

  SELECT j.*
    INTO v_job
  FROM public.jobs j
  WHERE j.id = p_job_id
    AND j.company_id = p_company_id
    AND j.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- The job lock serializes all selection changes for this job. Row ordering
  -- keeps the secondary locks deterministic for old and new measurement sets.
  PERFORM 1
  FROM public.measurement_records m
  WHERE m.job_id = p_job_id
  ORDER BY m.id
  FOR UPDATE;

  IF p_measurement_id IS NOT NULL THEN
    SELECT m.*
      INTO v_measurement
    FROM public.measurement_records m
    WHERE m.id = p_measurement_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'measurement_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_measurement.company_id IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'measurement_company_mismatch' USING ERRCODE = '42501';
    END IF;

    IF v_measurement.job_id IS DISTINCT FROM p_job_id THEN
      RAISE EXCEPTION 'measurement_job_mismatch' USING ERRCODE = '23514';
    END IF;

    IF v_measurement.status IN ('rejected', 'stale') THEN
      RAISE EXCEPTION 'measurement_not_selectable' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.measurement_records m
  SET is_selected = false,
      updated_at = now()
  WHERE m.job_id = p_job_id
    AND m.is_selected = true
    AND (p_measurement_id IS NULL OR m.id <> p_measurement_id);

  IF p_measurement_id IS NOT NULL THEN
    UPDATE public.measurement_records m
    SET is_selected = true,
        updated_at = CASE WHEN m.is_selected THEN m.updated_at ELSE now() END
    WHERE m.id = p_measurement_id
      AND m.is_selected IS DISTINCT FROM true
    RETURNING m.* INTO v_measurement;

    IF NOT FOUND THEN
      SELECT m.* INTO v_measurement
      FROM public.measurement_records m
      WHERE m.id = p_measurement_id;
    END IF;
  END IF;

  UPDATE public.jobs j
  SET selected_measurement_id = p_measurement_id,
      updated_at = CASE
        WHEN j.selected_measurement_id IS DISTINCT FROM p_measurement_id THEN now()
        ELSE j.updated_at
      END
  WHERE j.id = p_job_id;

  RETURN QUERY SELECT p_company_id, p_job_id, p_measurement_id,
    (p_measurement_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.select_job_measurement_v1(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_job_measurement_v1(uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.select_job_measurement_v1(uuid, uuid, uuid)
IS 'Atomically selects or clears one same-company, same-job selectable measurement while synchronizing measurement_records.is_selected and jobs.selected_measurement_id.';

COMMENT ON CONSTRAINT jobs_selected_measurement_id_fkey ON public.jobs
IS 'Deletion safety for the synchronized measurement pointer. Same-job and same-company ownership are enforced by jobs_validate_selected_measurement_v1.';
