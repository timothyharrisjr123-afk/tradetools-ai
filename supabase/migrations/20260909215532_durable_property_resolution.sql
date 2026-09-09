-- Google Places Slice C: durable, company-scoped Property identity.
-- address_normalized already includes line2/unit, so distinct units remain distinct.

CREATE UNIQUE INDEX properties_company_address_normalized_uidx
  ON public.properties (company_id, address_normalized)
  WHERE address_normalized <> '';

CREATE INDEX properties_company_places_place_id_idx
  ON public.properties (company_id, places_place_id)
  WHERE places_place_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_company_property_v1(
  p_company_id uuid,
  p_line1 text,
  p_line2 text,
  p_city text,
  p_state text,
  p_zip text,
  p_formatted text DEFAULT NULL,
  p_places_place_id text DEFAULT NULL
)
RETURNS TABLE (
  property_id uuid,
  resolution text,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text,
  address_formatted text,
  address_normalized text,
  places_place_id text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_normalized text;
  v_place_id text := NULLIF(btrim(p_places_place_id), '');
  v_row public.properties%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_memberships m
    WHERE m.company_id = p_company_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'company_membership_required' USING ERRCODE = '42501';
  END IF;

  v_normalized := public.normalize_property_address_v1(
    p_line1, p_line2, p_city, p_state, p_zip, p_formatted
  );
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'property_address_invalid' USING ERRCODE = '22023';
  END IF;

  -- Serialize one canonical identity without locking unrelated companies/addresses.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text || '|' || v_normalized, 0));

  SELECT p.* INTO v_row
  FROM public.properties p
  WHERE p.company_id = p_company_id
    AND p.address_normalized = v_normalized
  ORDER BY p.created_at, p.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_place_id IS NOT NULL AND v_row.places_place_id IS NOT NULL
       AND v_row.places_place_id <> v_place_id THEN
      RAISE EXCEPTION 'property_identity_conflict' USING ERRCODE = '23505';
    END IF;
    IF v_place_id IS NOT NULL AND v_row.places_place_id IS NULL THEN
      UPDATE public.properties SET places_place_id = v_place_id, updated_at = now()
      WHERE id = v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN QUERY SELECT v_row.id, 'reused'::text, v_row.address_line1,
      v_row.address_line2, v_row.address_city, v_row.address_state,
      v_row.address_zip, v_row.address_country, v_row.address_formatted,
      v_row.address_normalized, v_row.places_place_id;
    RETURN;
  END IF;

  INSERT INTO public.properties (
    company_id, address_line1, address_line2, address_city, address_state,
    address_zip, address_country, address_formatted, address_normalized, places_place_id
  ) VALUES (
    p_company_id, NULLIF(btrim(p_line1), ''), NULLIF(btrim(p_line2), ''),
    NULLIF(btrim(p_city), ''), NULLIF(btrim(p_state), ''), NULLIF(btrim(p_zip), ''),
    'US', NULLIF(btrim(p_formatted), ''), v_normalized, v_place_id
  ) RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, 'created'::text, v_row.address_line1,
    v_row.address_line2, v_row.address_city, v_row.address_state,
    v_row.address_zip, v_row.address_country, v_row.address_formatted,
    v_row.address_normalized, v_row.places_place_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_property_v1(uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_property_v1(uuid,text,text,text,text,text,text,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_company_property_v1(uuid,text,text,text,text,text,text,text)
IS 'Atomically resolves one company-scoped, unit-aware Property. Authenticated membership required; jobs retain independent address snapshots.';
