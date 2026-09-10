-- FieldDive Phase 0B2B — retire temporary property uniqueness ops_guard
-- Target: production project rhquhnujjnzjhweypavd ONLY after Phase 0B2B runtime proof.
-- Authorized DDL: drop ONLY properties_company_address_normalized_uidx_ops_guard
-- Do NOT alter Slice C migration, canonical index, resolver, or unrelated objects.
-- Fail closed if prerequisites differ.

BEGIN;

DO $$
DECLARE
  v_canonical_exists boolean;
  v_canonical_valid boolean;
  v_ops_guard_exists boolean;
  v_resolver_exists boolean;
  v_dup_norm integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'properties_company_address_normalized_uidx'
  )
  INTO v_canonical_exists;

  IF NOT v_canonical_exists THEN
    RAISE EXCEPTION 'REFUSE: canonical unique index properties_company_address_normalized_uidx missing';
  END IF;

  SELECT i.indisvalid
  INTO v_canonical_valid
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'properties_company_address_normalized_uidx';

  IF v_canonical_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'REFUSE: canonical unique index is not valid';
  END IF;

  SELECT count(*)::int
  INTO v_dup_norm
  FROM (
    SELECT company_id, address_normalized
    FROM public.properties
    WHERE address_normalized IS NOT NULL
      AND address_normalized <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) d;

  IF v_dup_norm <> 0 THEN
    RAISE EXCEPTION 'REFUSE: normalized duplicate groups present (%)', v_dup_norm;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'resolve_company_property_v1'
  )
  INTO v_resolver_exists;

  IF NOT v_resolver_exists THEN
    RAISE EXCEPTION 'REFUSE: resolve_company_property_v1 missing';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'properties_company_address_normalized_uidx_ops_guard'
  )
  INTO v_ops_guard_exists;

  IF NOT v_ops_guard_exists THEN
    RAISE EXCEPTION 'REFUSE: temporary ops_guard already absent; refusing blind re-run';
  END IF;

  EXECUTE 'DROP INDEX public.properties_company_address_normalized_uidx_ops_guard';

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'properties_company_address_normalized_uidx'
  )
  INTO v_canonical_exists;

  IF NOT v_canonical_exists THEN
    RAISE EXCEPTION 'REFUSE: canonical unique index missing after ops_guard drop';
  END IF;

  SELECT i.indisvalid
  INTO v_canonical_valid
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'properties_company_address_normalized_uidx';

  IF v_canonical_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'REFUSE: canonical unique index invalid after ops_guard drop';
  END IF;

  RAISE NOTICE 'ops_guard removed; canonical uniqueness remains valid';
END $$;

COMMIT;

-- Post-condition probe (read-only expectations for operators):
-- ops_guard absent
-- canonical unique index present + valid
-- resolve_company_property_v1 present
-- migration ledger unchanged
-- normalized duplicate groups = 0
