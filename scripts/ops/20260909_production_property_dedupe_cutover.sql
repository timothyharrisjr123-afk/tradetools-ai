-- FieldDive PRODUCTION-ONLY bounded property duplicate remediation + ops_guard.
-- NOT a schema migration. Do NOT place under supabase/migrations.
--
-- Purpose: reconcile exactly three audited (company_id, address_normalized) duplicate
-- groups on production rhquhnujjnzjhweypavd so Slice C unique index can apply.
--
-- Contract (fail-closed):
--   company: e1fd48bb-fe22-4dfe-9622-3f25eb2109b6
--   16 property rows / 3 survivors / 13 retirees / 12 jobs.property_id relinks
--   no Place IDs / no address_line2
--   historical job/customer/proposal snapshots MUST NOT be rewritten
--
-- Rerun safety: any already-changed state fails assertions (no silent remutation).
-- Temporary uniqueness: properties_company_address_normalized_uidx_ops_guard
-- Canonical Slice C index name is intentionally NOT created here.

BEGIN;

-- Serialize against concurrent inserts for the three audited identities.
SELECT pg_advisory_xact_lock(hashtextextended('e1fd48bb-fe22-4dfe-9622-3f25eb2109b6|1842 oak ridge drive||austin|tx|78704', 0));
SELECT pg_advisory_xact_lock(hashtextextended('e1fd48bb-fe22-4dfe-9622-3f25eb2109b6|100 visual proof lane||austin|tx|78701', 0));
SELECT pg_advisory_xact_lock(hashtextextended('e1fd48bb-fe22-4dfe-9622-3f25eb2109b6|8801 wave c trail||tulsa|ok|74136', 0));

-- Lock the exact 16 audited property rows.
SELECT id
FROM public.properties
WHERE id IN (
  '5cdca7bc-3401-4617-9abb-786f97ab5ebc',
  'd4632837-668e-4b49-a4d2-d25488c242c5',
  '28b8f875-536c-4fb4-8cc3-e19616e0bc2d',
  'ea2aeaf3-c241-45f7-8aa2-ac13e46ade0a',
  '75144d73-41f0-442f-b328-bb1c9f9cd3ec',
  'e3883852-f051-4df8-b047-09cbb69b2807',
  'b68b19b4-7aba-4f49-bbb3-97c3567ae340',
  'b8c69bff-7308-4afd-8c11-f56567b93d52',
  'c652cd64-3f97-406a-802e-d657b7740f5c',
  '8547e8d0-77ea-49e2-b9f7-55ca5f014b0b',
  '4ed0cfbb-0e5b-4cea-a75a-f7fa10b27064',
  'ed4d4b42-2935-4c0c-aa8d-051997521210',
  'c9010cb9-699a-445e-891a-3edc5d545345',
  'cb580913-d621-4f83-8964-0a1808b2dc5f',
  '3b816b25-1098-42cd-88d4-0a3e0d464fca',
  'f8944d4d-af02-4688-b821-397141a82394'
)
FOR UPDATE;

DO $$
DECLARE
  v_company uuid := 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6';
  v_norm_a text := '1842 oak ridge drive||austin|tx|78704';
  v_norm_b text := '100 visual proof lane||austin|tx|78701';
  v_norm_c text := '8801 wave c trail||tulsa|ok|74136';
  v_surv_a uuid := '5cdca7bc-3401-4617-9abb-786f97ab5ebc';
  v_surv_b uuid := 'c652cd64-3f97-406a-802e-d657b7740f5c';
  v_surv_c uuid := '3b816b25-1098-42cd-88d4-0a3e0d464fca';
  v_ret_a uuid[] := ARRAY[
    'd4632837-668e-4b49-a4d2-d25488c242c5'::uuid,
    '28b8f875-536c-4fb4-8cc3-e19616e0bc2d'::uuid,
    'ea2aeaf3-c241-45f7-8aa2-ac13e46ade0a'::uuid,
    '75144d73-41f0-442f-b328-bb1c9f9cd3ec'::uuid,
    'e3883852-f051-4df8-b047-09cbb69b2807'::uuid,
    'b68b19b4-7aba-4f49-bbb3-97c3567ae340'::uuid,
    'b8c69bff-7308-4afd-8c11-f56567b93d52'::uuid
  ];
  v_ret_b uuid[] := ARRAY[
    '8547e8d0-77ea-49e2-b9f7-55ca5f014b0b'::uuid,
    '4ed0cfbb-0e5b-4cea-a75a-f7fa10b27064'::uuid,
    'ed4d4b42-2935-4c0c-aa8d-051997521210'::uuid,
    'c9010cb9-699a-445e-891a-3edc5d545345'::uuid,
    'cb580913-d621-4f83-8964-0a1808b2dc5f'::uuid
  ];
  v_ret_c uuid[] := ARRAY[
    'f8944d4d-af02-4688-b821-397141a82394'::uuid
  ];
  v_all uuid[];
  v_retirees uuid[];
  v_cnt int;
  v_relink int := 0;
  v_deleted int := 0;
  v_n int;
BEGIN
  v_all := ARRAY[v_surv_a] || v_ret_a || ARRAY[v_surv_b] || v_ret_b || ARRAY[v_surv_c] || v_ret_c;
  v_retirees := v_ret_a || v_ret_b || v_ret_c;

  SELECT count(*)::int INTO v_cnt FROM public.properties WHERE id = ANY(v_all);
  IF v_cnt <> 16 THEN
    RAISE EXCEPTION 'assert_fail: expected 16 audited properties, found %', v_cnt;
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE id = ANY(v_all) AND company_id = v_company;
  IF v_cnt <> 16 THEN
    RAISE EXCEPTION 'assert_fail: company mismatch';
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE id = ANY(v_all) AND (places_place_id IS NOT NULL OR address_line2 IS NOT NULL);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'assert_fail: place_id or line2 present';
  END IF;

  -- Group membership + normalized identity
  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE company_id = v_company
    AND address_normalized = v_norm_a
    AND id = ANY(ARRAY[v_surv_a] || v_ret_a);
  IF v_cnt <> 8 THEN
    RAISE EXCEPTION 'assert_fail: group A membership count %', v_cnt;
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE company_id = v_company
    AND address_normalized = v_norm_b
    AND id = ANY(ARRAY[v_surv_b] || v_ret_b);
  IF v_cnt <> 6 THEN
    RAISE EXCEPTION 'assert_fail: group B membership count %', v_cnt;
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE company_id = v_company
    AND address_normalized = v_norm_c
    AND id = ANY(ARRAY[v_surv_c] || v_ret_c);
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'assert_fail: group C membership count %', v_cnt;
  END IF;

  -- Survivors must exist with expected norms
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_surv_a AND company_id = v_company AND address_normalized = v_norm_a
  ) THEN
    RAISE EXCEPTION 'assert_fail: survivor A missing/mismatched';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_surv_b AND company_id = v_company AND address_normalized = v_norm_b
  ) THEN
    RAISE EXCEPTION 'assert_fail: survivor B missing/mismatched';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_surv_c AND company_id = v_company AND address_normalized = v_norm_c
  ) THEN
    RAISE EXCEPTION 'assert_fail: survivor C missing/mismatched';
  END IF;

  -- Expected pre-relink job pointer counts on retirees = 12
  SELECT coalesce(sum(n), 0)::int INTO v_n
  FROM (
    SELECT count(*)::int AS n
    FROM public.jobs
    WHERE property_id = ANY(v_retirees)
    GROUP BY property_id
  ) t;
  -- count rows not groups:
  SELECT count(*)::int INTO v_n FROM public.jobs WHERE property_id = ANY(v_retirees);
  IF v_n <> 12 THEN
    RAISE EXCEPTION 'assert_fail: expected 12 retiree job pointers, found %', v_n;
  END IF;

  -- Relink ONLY jobs.property_id (no snapshot column updates)
  UPDATE public.jobs
  SET property_id = v_surv_a
  WHERE property_id = ANY(v_ret_a);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_relink := v_relink + v_cnt;

  UPDATE public.jobs
  SET property_id = v_surv_b
  WHERE property_id = ANY(v_ret_b);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_relink := v_relink + v_cnt;

  UPDATE public.jobs
  SET property_id = v_surv_c
  WHERE property_id = ANY(v_ret_c);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_relink := v_relink + v_cnt;

  IF v_relink <> 12 THEN
    RAISE EXCEPTION 'assert_fail: expected 12 job relinks, got %', v_relink;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.jobs WHERE property_id = ANY(v_retirees);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'assert_fail: retiree job pointers remain (%)',
 v_cnt;
  END IF;

  DELETE FROM public.properties WHERE id = ANY(v_retirees);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 13 THEN
    RAISE EXCEPTION 'assert_fail: expected 13 deletes, got %', v_deleted;
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.properties
  WHERE id IN (v_surv_a, v_surv_b, v_surv_c);
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION 'assert_fail: survivors remaining %', v_cnt;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.properties WHERE id = ANY(v_retirees);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'assert_fail: retirees still present';
  END IF;

  SELECT count(*)::int INTO v_cnt FROM (
    SELECT 1
    FROM public.properties
    WHERE company_id = v_company
      AND address_normalized IN (v_norm_a, v_norm_b, v_norm_c)
    GROUP BY address_normalized
    HAVING count(*) > 1
  ) t;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'assert_fail: duplicate groups remain in audited norms';
  END IF;

  SELECT count(*)::int INTO v_cnt
  FROM public.jobs j
  WHERE j.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = j.property_id);
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'assert_fail: orphan jobs.property_id %', v_cnt;
  END IF;

  RAISE NOTICE 'phase0a_remediation_ok relink=% delete=%', v_relink, v_deleted;
END $$;

-- Temporary uniqueness (distinct name from Slice C canonical index).
CREATE UNIQUE INDEX properties_company_address_normalized_uidx_ops_guard
  ON public.properties (company_id, address_normalized)
  WHERE address_normalized <> '';

-- Guard presence check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'properties_company_address_normalized_uidx_ops_guard'
  ) THEN
    RAISE EXCEPTION 'assert_fail: ops_guard missing after create';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'properties_company_address_normalized_uidx'
  ) THEN
    RAISE EXCEPTION 'assert_fail: canonical unique index must not exist yet';
  END IF;
END $$;

COMMIT;
