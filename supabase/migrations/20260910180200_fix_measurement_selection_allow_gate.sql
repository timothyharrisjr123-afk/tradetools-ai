-- FD-P1-10 follow-up: do not leave fielddive.allow_measurement_selection=1
-- armed for the remainder of a transaction after jobs pointer sync.
-- The initial guard migration armed the gate at function entry (and/or left it
-- set after NULL-pointer job inserts), which allowed raw is_selected writes later
-- in the same transaction.

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

COMMENT ON FUNCTION public.jobs_validate_selected_measurement_v1()
IS 'Validates same-job measurement pointers and synchronizes is_selected. Arms fielddive.allow_measurement_selection only around flag updates, then clears it.';
