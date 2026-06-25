-- R18B2 — Atomic proposal send-freeze persistence (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Wraps immutable sent snapshot creation (new sent proposal_version + copied pages/options/
-- lines/summaries + latest_sent pointer + snapshot_frozen event) in a single transaction.
--
-- TypeScript readiness + payload builder remains in app code (proposalSendFreezePersistence.ts);
-- this RPC persists a pre-built JSON payload from persist_proposal_send_freeze_v1 callers.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- No token table, public route, Send/PDF/Sign/Payment, or lifecycle UI enablement.

-- ---------------------------------------------------------------------------
-- 1. Extend proposal_events.event_type for snapshot_frozen (R18B foundation)
-- ---------------------------------------------------------------------------

alter table public.proposal_events
  drop constraint if exists proposal_events_event_type_check;

alter table public.proposal_events
  add constraint proposal_events_event_type_check check (
    event_type in (
      'created',
      'draft_saved',
      'previewed',
      'sent',
      'viewed',
      'signed',
      'declined',
      'revised',
      'archived',
      'payment_requested',
      'payment_recorded',
      'snapshot_frozen'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Immutability guards — sent/signed/superseded version child rows (R18B3 apply)
-- ---------------------------------------------------------------------------

create or replace function public.proposal_immutable_version_child_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kind text;
  v_version_id uuid;
begin
  if tg_table_name = 'proposal_pages' then
    v_version_id := coalesce(old.proposal_version_id, new.proposal_version_id);
  elsif tg_table_name = 'proposal_options' then
    v_version_id := coalesce(old.proposal_version_id, new.proposal_version_id);
  elsif tg_table_name = 'proposal_line_items' then
    select po.proposal_version_id
      into v_version_id
    from public.proposal_options po
    where po.id = coalesce(old.proposal_option_id, new.proposal_option_id);
  elsif tg_table_name = 'proposal_internal_summaries' then
    select po.proposal_version_id
      into v_version_id
    from public.proposal_options po
    where po.id = coalesce(old.proposal_option_id, new.proposal_option_id);
  else
    return coalesce(new, old);
  end if;

  select pv.version_kind
    into v_kind
  from public.proposal_versions pv
  where pv.id = v_version_id;

  if v_kind in ('sent', 'signed', 'superseded') then
    raise exception 'Immutable proposal version rows cannot be modified (version_kind=%)', v_kind;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.proposal_immutable_version_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.version_kind in ('sent', 'signed', 'superseded') then
      if new.version_kind = 'superseded' and old.version_kind = 'sent' then
        return new;
      end if;
      raise exception 'Immutable proposal_versions row cannot be updated (kind=%)', old.version_kind;
    end if;
  elsif tg_op = 'DELETE' then
    if old.version_kind in ('sent', 'signed', 'superseded') then
      raise exception 'Immutable proposal_versions row cannot be deleted (kind=%)', old.version_kind;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_pages_immutable_version_guard on public.proposal_pages;
create trigger proposal_pages_immutable_version_guard
  before update or delete on public.proposal_pages
  for each row
  execute function public.proposal_immutable_version_child_guard();

drop trigger if exists proposal_options_immutable_version_guard on public.proposal_options;
create trigger proposal_options_immutable_version_guard
  before update or delete on public.proposal_options
  for each row
  execute function public.proposal_immutable_version_child_guard();

drop trigger if exists proposal_line_items_immutable_version_guard on public.proposal_line_items;
create trigger proposal_line_items_immutable_version_guard
  before update or delete on public.proposal_line_items
  for each row
  execute function public.proposal_immutable_version_child_guard();

drop trigger if exists proposal_internal_summaries_immutable_version_guard on public.proposal_internal_summaries;
create trigger proposal_internal_summaries_immutable_version_guard
  before update or delete on public.proposal_internal_summaries
  for each row
  execute function public.proposal_immutable_version_child_guard();

drop trigger if exists proposal_versions_immutable_row_guard on public.proposal_versions;
create trigger proposal_versions_immutable_row_guard
  before update or delete on public.proposal_versions
  for each row
  execute function public.proposal_immutable_version_row_guard();

-- ---------------------------------------------------------------------------
-- 3. persist_proposal_send_freeze_v1
-- ---------------------------------------------------------------------------

create or replace function public.persist_proposal_send_freeze_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_draft_version_id uuid;
  v_sent_version_id uuid;
  v_version_number integer;
  v_frozen_at timestamptz;
  v_parent_version_id uuid;
  v_current_draft_version_id uuid;
  v_latest_sent_version_id uuid;
  v_signed_version_id uuid;
  v_draft_version_kind text;
  v_draft_frozen_at timestamptz;
  v_update_proposal_status text;
  page jsonb;
  opt jsonb;
  line jsonb;
  v_page_id uuid;
  v_option_id uuid;
  v_section_id uuid;
  v_line_page_id uuid;
  v_section_to_page jsonb := '{}'::jsonb;
  v_inserted_page_ids jsonb := '{}'::jsonb;
  v_page_count integer := 0;
  v_option_count integer := 0;
  v_event jsonb;
  v_forbidden_keys text[] := array[
    'public_token', 'token_hash', 'email', 'send',
    'scope_decisions', 'scopeDecisions', 'payment', 'signature', 'pdf'
  ];
  k text;
begin
  foreach k in array v_forbidden_keys loop
    if p_payload ? k then
      raise exception 'Forbidden send-freeze payload key: %', k;
    end if;
  end loop;

  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_proposal_id := nullif(trim(p_payload->>'proposal_id'), '')::uuid;
  v_draft_version_id := nullif(trim(p_payload->>'draft_version_id'), '')::uuid;
  v_sent_version_id := nullif(trim(p_payload->>'sent_version_id'), '')::uuid;
  v_version_number := nullif(trim(p_payload->>'version_number'), '')::integer;
  v_frozen_at := nullif(trim(p_payload->>'frozen_at'), '')::timestamptz;
  v_parent_version_id := nullif(trim(p_payload->>'parent_version_id'), '')::uuid;
  v_update_proposal_status := nullif(trim(p_payload->>'update_proposal_status'), '');

  if v_company_id is null
    or v_proposal_id is null
    or v_draft_version_id is null
    or v_sent_version_id is null
    or v_version_number is null
    or v_frozen_at is null
  then
    raise exception 'company_id, proposal_id, draft_version_id, sent_version_id, version_number, and frozen_at are required';
  end if;

  if coalesce(nullif(trim(p_payload->>'version_kind'), ''), 'sent') <> 'sent' then
    raise exception 'version_kind must be sent';
  end if;

  if v_parent_version_id is distinct from v_draft_version_id then
    raise exception 'parent_version_id must equal draft_version_id';
  end if;

  if jsonb_typeof(coalesce(p_payload->'context_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'context_echo must be a JSON object';
  end if;

  if jsonb_typeof(coalesce(p_payload->'policy_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'policy_echo must be a JSON object';
  end if;

  if jsonb_array_length(coalesce(p_payload->'pages', '[]'::jsonb)) = 0 then
    raise exception 'At least one page is required';
  end if;

  if jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb)) = 0 then
    raise exception 'At least one option is required';
  end if;

  if v_update_proposal_status is not null then
    raise exception 'update_proposal_status must be null until delivery phases are approved';
  end if;

  if exists (
    select 1
    from public.proposal_versions pv
    where pv.id = v_sent_version_id
  ) then
    raise exception 'sent_version_id already exists';
  end if;

  select
    p.current_draft_version_id,
    p.latest_sent_version_id,
    p.signed_version_id
    into v_current_draft_version_id, v_latest_sent_version_id, v_signed_version_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Proposal not found for company';
  end if;

  if v_current_draft_version_id is distinct from v_draft_version_id then
    raise exception 'draft_version_id is not the current draft version';
  end if;

  select pv.version_kind, pv.frozen_at
    into v_draft_version_kind, v_draft_frozen_at
  from public.proposal_versions pv
  where pv.id = v_draft_version_id
    and pv.company_id = v_company_id
    and pv.proposal_id = v_proposal_id
  for update;

  if not found then
    raise exception 'Draft version not found for proposal';
  end if;

  if v_draft_version_kind <> 'draft' then
    raise exception 'Source version is not a mutable draft';
  end if;

  if v_draft_frozen_at is not null then
    raise exception 'Draft version is already frozen';
  end if;

  if exists (
    select 1
    from public.proposal_versions pv
    where pv.company_id = v_company_id
      and pv.proposal_id = v_proposal_id
      and pv.version_number = v_version_number
  ) then
    raise exception 'version_number already exists for proposal';
  end if;

  insert into public.proposal_versions (
    id,
    company_id,
    proposal_id,
    version_number,
    version_kind,
    parent_version_id,
    frozen_at,
    context_echo,
    policy_echo,
    created_by
  ) values (
    v_sent_version_id,
    v_company_id,
    v_proposal_id,
    v_version_number,
    'sent',
    v_parent_version_id,
    v_frozen_at,
    coalesce(p_payload->'context_echo', '{}'::jsonb),
    coalesce(p_payload->'policy_echo', '{}'::jsonb),
    null
  );

  for page in
    select value
    from jsonb_array_elements(coalesce(p_payload->'pages', '[]'::jsonb))
  loop
    v_page_id := coalesce(
      nullif(page->>'client_page_id', '')::uuid,
      gen_random_uuid()
    );

    insert into public.proposal_pages (
      id,
      company_id,
      proposal_version_id,
      page_type,
      sort_order,
      title,
      customer_title,
      visible_to_customer,
      source_template_section_id,
      content_json,
      settings_json
    ) values (
      v_page_id,
      v_company_id,
      v_sent_version_id,
      coalesce(nullif(page->>'page_type', ''), 'custom_text'),
      coalesce(nullif(page->>'sort_order', '')::integer, 0),
      coalesce(nullif(page->>'title', ''), 'Page'),
      nullif(page->>'customer_title', ''),
      coalesce((page->>'visible_to_customer')::boolean, true),
      nullif(page->>'source_template_section_id', '')::uuid,
      coalesce(page->'content_json', '{}'::jsonb),
      coalesce(page->'settings_json', '{}'::jsonb)
    );

    v_page_count := v_page_count + 1;
    v_inserted_page_ids := v_inserted_page_ids || jsonb_build_object(v_page_id::text, true);

    if nullif(page->>'source_template_section_id', '') is not null then
      v_section_to_page := v_section_to_page || jsonb_build_object(
        nullif(page->>'source_template_section_id', ''),
        v_page_id::text
      );
    end if;
  end loop;

  for opt in
    select value
    from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    if nullif(trim(opt->>'source_template_option_id'), '') is null then
      raise exception 'Each option payload requires source_template_option_id';
    end if;

    insert into public.proposal_options (
      company_id,
      proposal_version_id,
      source_template_option_id,
      name,
      customer_label,
      sort_order,
      is_default,
      visible_to_customer,
      customer_subtotal_cents,
      discount_cents,
      sales_tax_cents,
      customer_total_cents,
      pricing_complete,
      blocking_line_count,
      guardrail_outcome,
      selected_at
    ) values (
      v_company_id,
      v_sent_version_id,
      nullif(opt->>'source_template_option_id', '')::uuid,
      coalesce(nullif(opt->>'name', ''), 'Option'),
      nullif(opt->>'customer_label', ''),
      coalesce(nullif(opt->>'sort_order', '')::integer, 0),
      coalesce((opt->>'is_default')::boolean, false),
      coalesce((opt->>'visible_to_customer')::boolean, true),
      nullif(opt->>'customer_subtotal_cents', '')::integer,
      coalesce(nullif(opt->>'discount_cents', '')::integer, 0),
      coalesce(nullif(opt->>'sales_tax_cents', '')::integer, 0),
      nullif(opt->>'customer_total_cents', '')::integer,
      coalesce((opt->>'pricing_complete')::boolean, false),
      coalesce(nullif(opt->>'blocking_line_count', '')::integer, 0),
      coalesce(nullif(opt->>'guardrail_outcome', ''), 'pass'),
      nullif(opt->>'selected_at', '')::timestamptz
    )
    returning id into v_option_id;

    v_option_count := v_option_count + 1;

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      v_line_page_id := nullif(line->>'page_id', '')::uuid;
      v_section_id := nullif(line->>'section_id', '')::uuid;
      v_page_id := null;

      if v_line_page_id is not null and v_inserted_page_ids ? v_line_page_id::text then
        v_page_id := v_line_page_id;
      elsif v_section_id is not null and v_section_to_page ? v_section_id::text then
        v_page_id := (v_section_to_page->>v_section_id::text)::uuid;
      end if;

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
        v_section_id,
        v_page_id,
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

  update public.proposals
  set latest_sent_version_id = v_sent_version_id
  where id = v_proposal_id
    and company_id = v_company_id;

  v_event := p_payload->'event';
  if v_event is null or v_event = 'null'::jsonb then
    raise exception 'event payload is required';
  end if;

  if coalesce(nullif(v_event->>'event_type', ''), '') <> 'snapshot_frozen' then
    raise exception 'event.event_type must be snapshot_frozen';
  end if;

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
    v_sent_version_id,
    'snapshot_frozen',
    nullif(v_event->>'actor_user_id', '')::uuid,
    coalesce(v_event->'payload_json', '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'draft_version_id', v_draft_version_id,
    'sent_version_id', v_sent_version_id,
    'version_number', v_version_number,
    'page_count', v_page_count,
    'option_count', v_option_count,
    'latest_sent_version_id', v_sent_version_id
  );
end;
$$;

comment on function public.persist_proposal_send_freeze_v1(jsonb) is
  'Atomically persists a pre-built send-freeze payload (immutable sent snapshot). Does not mutate draft rows, enable delivery, or create public tokens.';

revoke all on function public.persist_proposal_send_freeze_v1(jsonb) from public;
grant execute on function public.persist_proposal_send_freeze_v1(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback notes (manual — not executed):
-- drop function if exists public.persist_proposal_send_freeze_v1(jsonb);
-- drop trigger if exists proposal_versions_immutable_row_guard on public.proposal_versions;
-- drop trigger if exists proposal_internal_summaries_immutable_version_guard on public.proposal_internal_summaries;
-- drop trigger if exists proposal_line_items_immutable_version_guard on public.proposal_line_items;
-- drop trigger if exists proposal_options_immutable_version_guard on public.proposal_options;
-- drop trigger if exists proposal_pages_immutable_version_guard on public.proposal_pages;
-- drop function if exists public.proposal_immutable_version_row_guard();
-- drop function if exists public.proposal_immutable_version_child_guard();
-- (restore proposal_events_event_type_check without snapshot_frozen if needed)
