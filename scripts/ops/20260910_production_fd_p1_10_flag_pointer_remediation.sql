-- FieldDive FD-P1-10 PRODUCTION-ONLY residual flag/pointer coherence remediation.
-- Target: rhquhnujjnzjhweypavd.
-- Restores jobs.selected_measurement_id for exactly six audited same-job
-- flag_without_pointer rows through the A1 jobs pointer sync trigger.
-- Does not alter proposal_versions / frozen history / measurement identity.

BEGIN;

CREATE TEMP TABLE p110_targets (
  job_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  measurement_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO p110_targets (job_id, company_id, measurement_id) VALUES
  ('4d006897-2a66-4161-b2cd-11116e38af3c', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', 'a3da7525-09fc-46ad-9419-82c1585466f4'),
  ('6bddd1bf-7900-4b0a-b867-675f343fbb94', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '0c6e7e17-85bf-4cf2-b427-d064a7297125'),
  ('c8a7e3e6-12fe-4114-9b22-e6d1fca853e4', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '32a36a5b-215b-4df1-8749-9bdaf10b81ee'),
  ('c9497cc1-c8d2-406e-8455-5a6f9cc369d3', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', '62f5d03b-7215-4504-bb0c-3c1b116a79b3'),
  ('fa196452-aac4-4524-9a20-eb8bcdf507b7', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', 'bb974a31-e9d8-4f3f-a0f8-32ae61f79c70'),
  ('fb36f0ca-2821-4061-99f0-3866d1590ddc', 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6', 'ae7b4847-96a9-41bc-82b9-731114f08571');

DO $$
DECLARE
  v_count integer;
  v_updated integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.jobs j
  JOIN p110_targets t
    ON t.job_id = j.id
   AND t.company_id = j.company_id
   AND j.selected_measurement_id IS NULL;
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'REFUSE: expected 6 audited jobs with NULL pointer, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.measurement_records m
  JOIN p110_targets t
    ON t.measurement_id = m.id
   AND t.job_id = m.job_id
   AND t.company_id = m.company_id
   AND m.is_selected = true;
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'REFUSE: expected 6 audited selected measurements, found %', v_count;
  END IF;

  -- Each target job must have exactly one measurement and it must be the audited one.
  SELECT count(*) INTO v_count
  FROM (
    SELECT m.job_id
    FROM public.measurement_records m
    JOIN p110_targets t ON t.job_id = m.job_id
    GROUP BY m.job_id
    HAVING count(*) <> 1
        OR count(*) FILTER (WHERE m.id = (
             SELECT tt.measurement_id FROM p110_targets tt WHERE tt.job_id = m.job_id
           ) AND m.is_selected) <> 1
  ) bad;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: target job measurement shape changed';
  END IF;

  -- No extra flag_without_pointer rows beyond these six.
  SELECT count(*) INTO v_count
  FROM public.measurement_records mr
  JOIN public.jobs j ON j.id = mr.job_id
  WHERE mr.is_selected = true
    AND j.selected_measurement_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM p110_targets t WHERE t.job_id = j.id);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: unexpected additional flag_without_pointer rows: %', v_count;
  END IF;

  PERFORM j.id
  FROM public.jobs j
  JOIN p110_targets t ON t.job_id = j.id
  ORDER BY j.id
  FOR UPDATE;

  UPDATE public.jobs j
  SET selected_measurement_id = t.measurement_id,
      updated_at = now()
  FROM p110_targets t
  WHERE j.id = t.job_id
    AND j.company_id = t.company_id
    AND j.selected_measurement_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 6 THEN
    RAISE EXCEPTION 'REFUSE: expected to update 6 jobs, updated %', v_updated;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jobs j
  JOIN p110_targets t ON t.job_id = j.id
  WHERE j.selected_measurement_id IS DISTINCT FROM t.measurement_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: pointer restore incomplete';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.measurement_records m
  JOIN p110_targets t ON t.measurement_id = m.id
  WHERE m.is_selected IS DISTINCT FROM true;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: selected flags lost during pointer restore';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.measurement_records mr
  JOIN public.jobs j ON j.id = mr.job_id
  WHERE mr.is_selected = true
    AND j.selected_measurement_id IS NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'REFUSE: flag_without_pointer remains: %', v_count;
  END IF;

  RAISE NOTICE 'P110_REMEDIATE_OK updated=%', v_updated;
END $$;

COMMIT;
