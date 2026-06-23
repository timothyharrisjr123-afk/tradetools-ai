-- R2A — Atomic draft pricing refresh persistence (review only — do not apply without approval).
--
-- Wraps option pricing update + line/summary replacement + optional measurement
-- stamp + refresh event in a single Postgres transaction.
--
-- TypeScript pricing/snapshot math remains in app code; this RPC persists a
-- pre-built JSON payload from persist_draft_pricing_refresh_v1 callers.

create or replace function public.persist_draft_pricing_refresh_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_version_id uuid;
  v_proposal_status text;
  v_version_kind text;
  v_current_draft_version_id uuid;
  opt jsonb;
  v_option_id uuid;
  line jsonb;
  v_stamp jsonb;
  v_event jsonb;
begin
  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_proposal_id := nullif(trim(p_payload->>'proposal_id'), '')::uuid;
  v_version_id := nullif(trim(p_payload->>'proposal_version_id'), '')::uuid;

  if v_company_id is null or v_proposal_id is null or v_version_id is null then
    raise exception 'company_id, proposal_id, and proposal_version_id are required UUIDs';
  end if;

  select p.status, p.current_draft_version_id
    into v_proposal_status, v_current_draft_version_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Proposal not found for company';
  end if;

  if v_proposal_status <> 'draft' then
    raise exception 'Proposal is not in draft status';
  end if;

  if v_current_draft_version_id is distinct from v_version_id then
    raise exception 'proposal_version_id is not the current draft version';
  end if;

  select pv.version_kind
    into v_version_kind
  from public.proposal_versions pv
  where pv.id = v_version_id
    and pv.company_id = v_company_id
    and pv.proposal_id = v_proposal_id
  for update;

  if not found then
    raise exception 'Draft version not found for proposal';
  end if;

  if v_version_kind <> 'draft' then
    raise exception 'Version is not a mutable draft';
  end if;

  for opt in
    select value
    from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    v_option_id := nullif(trim(opt->>'proposal_option_id'), '')::uuid;

    if v_option_id is null then
      raise exception 'Each option payload requires proposal_option_id';
    end if;

    if not exists (
      select 1
      from public.proposal_options po
      where po.id = v_option_id
        and po.company_id = v_company_id
        and po.proposal_version_id = v_version_id
    ) then
      raise exception 'proposal_option_id % does not belong to draft version', v_option_id;
    end if;

    update public.proposal_options
    set
      customer_subtotal_cents = nullif(opt->'pricing'->>'customer_subtotal_cents', '')::integer,
      discount_cents = coalesce(nullif(opt->'pricing'->>'discount_cents', '')::integer, 0),
      sales_tax_cents = coalesce(nullif(opt->'pricing'->>'sales_tax_cents', '')::integer, 0),
      customer_total_cents = nullif(opt->'pricing'->>'customer_total_cents', '')::integer,
      pricing_complete = coalesce((opt->'pricing'->>'pricing_complete')::boolean, false),
      blocking_line_count = coalesce(nullif(opt->'pricing'->>'blocking_line_count', '')::integer, 0),
      guardrail_outcome = coalesce(nullif(opt->'pricing'->>'guardrail_outcome', ''), 'pass')
    where id = v_option_id
      and company_id = v_company_id;

    delete from public.proposal_line_items
    where company_id = v_company_id
      and proposal_option_id = v_option_id;

    delete from public.proposal_internal_summaries
    where company_id = v_company_id
      and proposal_option_id = v_option_id;

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      insert into public.proposal_line_items (
        company_id,
        proposal_option_id,
        source_template_item_id,
        catalog_item_id,
        catalog_seed_key,
        section_id,
        page_id,
        sort_order,
        customer_name,
        description,
        role,
        quantity,
        quantity_display_label,
        quantity_source_label,
        unit,
        customer_unit_price_cents,
        customer_line_total_cents,
        pricing_status,
        visible_to_customer,
        measurement_quantity_key
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'section_id', '')::uuid,
        nullif(line->>'page_id', '')::uuid,
        coalesce(nullif(line->>'sort_order', '')::integer, 0),
        coalesce(nullif(line->>'customer_name', ''), 'Line item'),
        nullif(line->>'description', ''),
        nullif(line->>'role', ''),
        nullif(line->>'quantity', '')::numeric,
        nullif(line->>'quantity_display_label', ''),
        nullif(line->>'quantity_source_label', ''),
        nullif(line->>'unit', ''),
        nullif(line->>'customer_unit_price_cents', '')::integer,
        nullif(line->>'customer_line_total_cents', '')::integer,
        coalesce(nullif(line->>'pricing_status', ''), 'needs_quantity'),
        coalesce((line->>'visible_to_customer')::boolean, true),
        nullif(line->>'measurement_quantity_key', '')
      );
    end loop;

    if opt->'internal_summary' is not null
      and opt->'internal_summary' <> 'null'::jsonb
    then
      insert into public.proposal_internal_summaries (
        company_id,
        proposal_option_id,
        internal_cost_cents,
        internal_profit_cents,
        effective_margin_pct,
        policy_echo_json,
        computed_at
      ) values (
        v_company_id,
        v_option_id,
        nullif(opt->'internal_summary'->>'internal_cost_cents', '')::integer,
        nullif(opt->'internal_summary'->>'internal_profit_cents', '')::integer,
        nullif(opt->'internal_summary'->>'effective_margin_pct', '')::numeric,
        coalesce(opt->'internal_summary'->'policy_echo_json', '{}'::jsonb),
        coalesce(
          nullif(opt->'internal_summary'->>'computed_at', '')::timestamptz,
          now()
        )
      );
    end if;
  end loop;

  v_stamp := p_payload->'measurement_stamp';
  if v_stamp is not null and v_stamp <> 'null'::jsonb then
    update public.proposal_versions
    set context_echo = coalesce(v_stamp->'context_echo', '{}'::jsonb)
    where id = v_version_id
      and company_id = v_company_id
      and proposal_id = v_proposal_id;

    if v_stamp ? 'measurement_record_id' then
      update public.proposals
      set measurement_record_id = nullif(v_stamp->>'measurement_record_id', '')::uuid
      where id = v_proposal_id
        and company_id = v_company_id;
    end if;
  end if;

  v_event := p_payload->'event';
  if v_event is not null and v_event <> 'null'::jsonb then
    insert into public.proposal_events (
      company_id,
      proposal_id,
      proposal_version_id,
      event_type,
      actor_user_id,
      payload_json
    ) values (
      v_company_id,
      v_proposal_id,
      v_version_id,
      coalesce(nullif(v_event->>'event_type', ''), 'draft_saved'),
      null,
      coalesce(v_event->'payload_json', '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_version_id,
    'option_count', jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb))
  );
end;
$$;

comment on function public.persist_draft_pricing_refresh_v1(jsonb) is
  'Atomically persists a pre-built draft pricing refresh payload (options, lines, summaries, measurement stamp, event).';

revoke all on function public.persist_draft_pricing_refresh_v1(jsonb) from public;
grant execute on function public.persist_draft_pricing_refresh_v1(jsonb) to authenticated;
