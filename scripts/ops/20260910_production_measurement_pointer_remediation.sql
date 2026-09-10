-- FieldDive FD-P0-02 PRODUCTION-ONLY bounded pointer remediation.
-- Target: rhquhnujjnzjhweypavd. DO NOT execute without separate authorization.
-- This is not a schema migration and does not alter measurement/proposal history.
--
-- Exact UUIDs were re-confirmed by a guarded BEGIN READ ONLY production probe.
-- Any changed truth aborts the transaction.

BEGIN;

CREATE TEMP TABLE a1_targets (
  job_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  selected_measurement_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO a1_targets (job_id, company_id, selected_measurement_id) VALUES
  ('b8635f31-d13b-45fe-9407-4aff26cba6ae', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '5153d06c-a4cd-442d-b03f-7fd0728dfc4a'),
  ('662e8ed3-c610-42cf-9ad9-8fc0fad1109d', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '5153d06c-a4cd-442d-b03f-7fd0728dfc4a'),
  ('6fb015e6-f01d-4c5e-a5a4-63f3b33a0d60', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '5153d06c-a4cd-442d-b03f-7fd0728dfc4a');

DO $$
DECLARE
  v_count integer;
  v_updated integer;
  v_company uuid := 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6';
  v_foreign_measurement uuid;
  v_foreign_job uuid := 'c3a26242-cb5d-4710-9837-589f3bed3269';
BEGIN
  SELECT count(*) INTO v_count
  FROM public.jobs j
  JOIN a1_targets t
    ON t.job_id = j.id
   AND t.company_id = j.company_id
   AND t.selected_measurement_id = j.selected_measurement_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'REFUSE: expected all 3 exact audited job pointers, found %', v_count;
  END IF;

  SELECT count(DISTINCT selected_measurement_id)
    INTO v_count
  FROM a1_targets;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'REFUSE: selected measurement differs from audited production truth';
  END IF;
  SELECT selected_measurement_id
    INTO v_foreign_measurement
  FROM a1_targets
  LIMIT 1;
  IF v_foreign_measurement <> '5153d06c-a4cd-442d-b03f-7fd0728dfc4a'::uuid THEN
    RAISE EXCEPTION 'REFUSE: selected measurement differs from audited production truth';
  END IF;

  PERFORM 1 FROM public.measurement_records m
  WHERE m.id = v_foreign_measurement
    AND m.job_id = v_foreign_job
    AND m.company_id = v_company
    AND m.is_selected = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUSE: foreign measurement owner/selection differs from audited truth';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.measurement_records m
  JOIN a1_targets t ON t.job_id = m.job_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: a target job now has a legitimate local measurement';
  END IF;

  PERFORM j.id
  FROM public.jobs j
  JOIN a1_targets t ON t.job_id = j.id
  ORDER BY j.id
  FOR UPDATE;

  UPDATE public.jobs j
  SET selected_measurement_id = NULL,
      updated_at = now()
  FROM a1_targets t
  WHERE j.id = t.job_id
    AND j.company_id = t.company_id
    AND j.selected_measurement_id = t.selected_measurement_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 3 THEN
    RAISE EXCEPTION 'REFUSE: expected exactly 3 pointer updates, updated %', v_updated;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jobs j
  JOIN a1_targets t ON t.job_id = j.id
  WHERE j.selected_measurement_id IS NOT NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: one or more target pointers remain non-null';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.measurement_records m
    WHERE m.id = v_foreign_measurement
      AND m.job_id = v_foreign_job
      AND m.is_selected = true
  ) THEN
    RAISE EXCEPTION 'REFUSE: owner measurement selection changed unexpectedly';
  END IF;

  -- FK was added NOT VALID by the A1 migration so production cutover can clear
  -- the known bad pointers first. Validate only after the three NULLs commit path.
  ALTER TABLE public.jobs
    VALIDATE CONSTRAINT jobs_selected_measurement_id_fkey;
END;
$$;

COMMIT;
