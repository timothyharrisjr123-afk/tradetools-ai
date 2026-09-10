-- FD-P1-10: block raw measurement_records.is_selected mutations outside the
-- A1 selection contract. Selection changes must go through
-- select_job_measurement_v1 or jobs.selected_measurement_id writes (which
-- synchronize flags via jobs_validate_selected_measurement_v1).

CREATE OR REPLACE FUNCTION public.measurement_records_guard_is_selected_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_selected IS TRUE
       AND current_setting('fielddive.allow_measurement_selection', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'measurement_selection_must_use_rpc'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_selected IS DISTINCT FROM OLD.is_selected
     AND current_setting('fielddive.allow_measurement_selection', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'measurement_selection_must_use_rpc'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.measurement_records_guard_is_selected_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.measurement_records_guard_is_selected_v1() TO service_role;

DROP TRIGGER IF EXISTS measurement_records_guard_is_selected_v1 ON public.measurement_records;
CREATE TRIGGER measurement_records_guard_is_selected_v1
BEFORE INSERT OR UPDATE OF is_selected ON public.measurement_records
FOR EACH ROW
EXECUTE FUNCTION public.measurement_records_guard_is_selected_v1();

-- Authorized writers set a transaction-local gate before mutating is_selected.
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
      PERFORM set_config('fielddive.allow_measurement_selection', '1', true);
      UPDATE public.measurement_records m
      SET is_selected = false,
          updated_at = now()
      WHERE m.job_id = NEW.id
        AND m.is_selected = true;
      PERFORM set_config('fielddive.allow_measurement_selection', '', true);
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

  IF TG_OP = 'INSERT'
     OR NEW.selected_measurement_id IS DISTINCT FROM OLD.selected_measurement_id THEN
    PERFORM set_config('fielddive.allow_measurement_selection', '1', true);
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
    PERFORM set_config('fielddive.allow_measurement_selection', '', true);
  END IF;

  RETURN NEW;
END;
$$;

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

  -- Authorize flag mutations for this transaction (also covers the jobs trigger).
  PERFORM set_config('fielddive.allow_measurement_selection', '1', true);

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

COMMENT ON FUNCTION public.measurement_records_guard_is_selected_v1()
IS 'Rejects raw is_selected mutations unless fielddive.allow_measurement_selection=1 for the transaction (set by select_job_measurement_v1 or jobs_validate_selected_measurement_v1).';

COMMENT ON FUNCTION public.select_job_measurement_v1(uuid, uuid, uuid)
IS 'Atomically selects or clears one same-company, same-job selectable measurement while synchronizing measurement_records.is_selected and jobs.selected_measurement_id.';
