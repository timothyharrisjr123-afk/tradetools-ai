-- 041 — Authoritative mutable draft-content dirty clock
-- AUTHOR ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- proposals.updated_at remains the generic proposal/header modification clock.
-- proposals.draft_content_changed_at is the revision-dirty owner:
--   draft_content_changed_at > latest_sent.frozen_at → dirty revision
--
-- 040 remains live historical truth and is not edited.
-- 039 remains absent/reserved.
-- 038 is unchanged.
-- persist_proposal_send_freeze_v1 is NOT replaced. Freeze must not advance
-- draft_content_changed_at (it may still bump generic updated_at).
--
-- No live Catalog. No live Templates. No repricing in backfill.

begin;

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------

alter table public.proposals
  add column if not exists draft_content_changed_at timestamptz;

comment on column public.proposals.draft_content_changed_at is
  'Latest time authoritative mutable customer-facing proposal content changed. Not send, token, delivery, acceptance, Attention, or generic header touch. Dirty vs latest sent freeze uses this clock, not updated_at.';

-- ---------------------------------------------------------------------------
-- 2. Internal touch helper — NOT a client/authenticated RPC
-- ---------------------------------------------------------------------------

create or replace function public.proposal_touch_draft_content_changed_at_internal_v1(
  p_company_id uuid,
  p_proposal_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_company_id is null or p_proposal_id is null then
    return null;
  end if;

  perform set_config('proposal.allow_draft_content_changed_at_touch', '1', true);

  update public.proposals
  set draft_content_changed_at = v_now
  where id = p_proposal_id
    and company_id = p_company_id;

  if not found then
    return null;
  end if;

  return v_now;
end;
$$;

revoke all on function public.proposal_touch_draft_content_changed_at_internal_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_touch_draft_content_changed_at_internal_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_touch_draft_content_changed_at_internal_v1(uuid, uuid)
  from authenticated;
revoke all on function public.proposal_touch_draft_content_changed_at_internal_v1(uuid, uuid)
  from service_role;

comment on function public.proposal_touch_draft_content_changed_at_internal_v1(uuid, uuid) is
  'INTERNAL. Called only from draft-scoped triggers. Advances proposals.draft_content_changed_at. Not granted to authenticated, anon, or service_role.';

-- ---------------------------------------------------------------------------
-- 3. Current-mutable-draft predicate
-- ---------------------------------------------------------------------------

create or replace function public.proposal_version_is_current_mutable_draft_v1(
  p_company_id uuid,
  p_proposal_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proposal_versions pv
    join public.proposals p
      on p.id = pv.proposal_id
     and p.company_id = pv.company_id
    where pv.id = p_proposal_version_id
      and pv.company_id = p_company_id
      and pv.version_kind = 'draft'
      and (
        p.current_draft_version_id is not distinct from pv.id
        or p.current_draft_version_id is null
      )
  );
$$;

revoke all on function public.proposal_version_is_current_mutable_draft_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_version_is_current_mutable_draft_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_version_is_current_mutable_draft_v1(uuid, uuid)
  from authenticated;

comment on function public.proposal_version_is_current_mutable_draft_v1(uuid, uuid) is
  'True when the version is the current mutable draft (kind=draft and current_draft_version_id matches, or draft during create before the pointer is set). Sent/frozen/historical versions are false.';

-- ---------------------------------------------------------------------------
-- 4. proposals header guard + selected package / measurement ownership
-- ---------------------------------------------------------------------------

create or replace function public.proposals_guard_draft_content_changed_at_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.draft_content_changed_at := coalesce(new.draft_content_changed_at, now());
    return new;
  end if;

  -- Clients cannot stamp the dirty clock. Internal trigger helper sets a txn GUC.
  if current_setting('proposal.allow_draft_content_changed_at_touch', true)
       is distinct from '1' then
    new.draft_content_changed_at := old.draft_content_changed_at;
  end if;

  if new.selected_option_id is distinct from old.selected_option_id
     or new.measurement_record_id is distinct from old.measurement_record_id then
    new.draft_content_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_guard_draft_content_changed_at on public.proposals;
create trigger proposals_guard_draft_content_changed_at
  before insert or update on public.proposals
  for each row
  execute function public.proposals_guard_draft_content_changed_at_v1();

-- ---------------------------------------------------------------------------
-- 5. Draft-scoped child triggers
-- ---------------------------------------------------------------------------

create or replace function public.proposal_touch_draft_content_from_version_id_v1(
  p_company_id uuid,
  p_proposal_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
begin
  if p_company_id is null or p_proposal_version_id is null then
    return;
  end if;

  if not public.proposal_version_is_current_mutable_draft_v1(
    p_company_id,
    p_proposal_version_id
  ) then
    return;
  end if;

  select pv.proposal_id
    into v_proposal_id
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id
    and pv.company_id = p_company_id;

  perform public.proposal_touch_draft_content_changed_at_internal_v1(
    p_company_id,
    v_proposal_id
  );
end;
$$;

revoke all on function public.proposal_touch_draft_content_from_version_id_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_touch_draft_content_from_version_id_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_touch_draft_content_from_version_id_v1(uuid, uuid)
  from authenticated;

create or replace function public.proposal_pages_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.proposal_pages%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.customer_title is not distinct from old.customer_title
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.sort_order is not distinct from old.sort_order
     and new.page_type is not distinct from old.page_type
     and new.content_json is not distinct from old.content_json
     and new.settings_json is not distinct from old.settings_json then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_pages_touch_draft_content on public.proposal_pages;
create trigger proposal_pages_touch_draft_content
  after insert or update or delete on public.proposal_pages
  for each row
  execute function public.proposal_pages_touch_draft_content_v1();

create or replace function public.proposal_options_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.proposal_options%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and new.customer_label is not distinct from old.customer_label
     and new.description is not distinct from old.description
     and new.sort_order is not distinct from old.sort_order
     and new.is_default is not distinct from old.is_default
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.customer_subtotal_cents is not distinct from old.customer_subtotal_cents
     and new.discount_cents is not distinct from old.discount_cents
     and new.sales_tax_cents is not distinct from old.sales_tax_cents
     and new.customer_total_cents is not distinct from old.customer_total_cents
     and new.pricing_complete is not distinct from old.pricing_complete
     and new.blocking_line_count is not distinct from old.blocking_line_count
     and new.selected_at is not distinct from old.selected_at then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_options_touch_draft_content on public.proposal_options;
create trigger proposal_options_touch_draft_content
  after insert or update or delete on public.proposal_options
  for each row
  execute function public.proposal_options_touch_draft_content_v1();

create or replace function public.proposal_line_items_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_option_id uuid;
  v_version_id uuid;
begin
  v_company_id := coalesce(new.company_id, old.company_id);
  v_option_id := coalesce(new.proposal_option_id, old.proposal_option_id);

  select po.proposal_version_id
    into v_version_id
  from public.proposal_options po
  where po.id = v_option_id
    and po.company_id = v_company_id;

  if v_version_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and new.source_template_item_id is not distinct from old.source_template_item_id
     and new.catalog_item_id is not distinct from old.catalog_item_id
     and new.catalog_seed_key is not distinct from old.catalog_seed_key
     and new.composition_role is not distinct from old.composition_role
     and new.composition_slot_key is not distinct from old.composition_slot_key
     and new.sort_order is not distinct from old.sort_order
     and new.customer_name is not distinct from old.customer_name
     and new.description is not distinct from old.description
     and new.role is not distinct from old.role
     and new.quantity is not distinct from old.quantity
     and new.quantity_display_label is not distinct from old.quantity_display_label
     and new.unit is not distinct from old.unit
     and new.customer_unit_price_cents is not distinct from old.customer_unit_price_cents
     and new.customer_line_total_cents is not distinct from old.customer_line_total_cents
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.quantity_resolution_echo is not distinct from old.quantity_resolution_echo
     and new.upgrade_selection_state is not distinct from old.upgrade_selection_state
     and new.upgrade_effect is not distinct from old.upgrade_effect
     and new.replaces_source_template_item_id is not distinct from old.replaces_source_template_item_id then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_company_id,
    v_version_id
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_line_items_touch_draft_content on public.proposal_line_items;
create trigger proposal_line_items_touch_draft_content
  after insert or update or delete on public.proposal_line_items
  for each row
  execute function public.proposal_line_items_touch_draft_content_v1();

create or replace function public.proposal_scope_decisions_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.proposal_option_scope_decisions%rowtype;
begin
  v_row := coalesce(new, old);
  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_scope_decisions_touch_draft_content
  on public.proposal_option_scope_decisions;
create trigger proposal_scope_decisions_touch_draft_content
  after insert or update or delete on public.proposal_option_scope_decisions
  for each row
  execute function public.proposal_scope_decisions_touch_draft_content_v1();

create or replace function public.proposal_upgrade_choices_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.proposal_option_upgrade_choices%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.selection_state is not distinct from old.selection_state
     and new.upgrade_effect is not distinct from old.upgrade_effect
     and new.replaces_source_template_item_id is not distinct from old.replaces_source_template_item_id then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_upgrade_choices_touch_draft_content
  on public.proposal_option_upgrade_choices;
create trigger proposal_upgrade_choices_touch_draft_content
  after insert or update or delete on public.proposal_option_upgrade_choices
  for each row
  execute function public.proposal_upgrade_choices_touch_draft_content_v1();

create or replace function public.proposal_versions_touch_draft_content_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.context_echo is not distinct from old.context_echo
     and new.policy_echo is not distinct from old.policy_echo then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    new.company_id,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists proposal_versions_touch_draft_content on public.proposal_versions;
create trigger proposal_versions_touch_draft_content
  after update of context_echo, policy_echo on public.proposal_versions
  for each row
  execute function public.proposal_versions_touch_draft_content_v1();

-- ---------------------------------------------------------------------------
-- 6. Client column privilege: authenticated cannot UPDATE the dirty clock
-- INSERT remains allowed so persist_draft_proposal_create_v1 can initialize it.
-- Trigger still assigns NEW.draft_content_changed_at on allowed header mutations.
-- ---------------------------------------------------------------------------

revoke update (draft_content_changed_at) on table public.proposals from public;
revoke update (draft_content_changed_at) on table public.proposals from anon;
revoke update (draft_content_changed_at) on table public.proposals from authenticated;

-- ---------------------------------------------------------------------------
-- 7–12. Backfill: persisted draft vs latest sent. Never uses proposals.updated_at.
-- ---------------------------------------------------------------------------

create or replace function public.proposal_draft_content_backfill_package_key_v1(
  p_source_template_option_id uuid,
  p_sort_order integer
)
returns text
language sql
immutable
as $$
  select case
    when p_source_template_option_id is not null then 'src:' || p_source_template_option_id::text
    else 'sort:' || coalesce(p_sort_order, 0)::text
  end;
$$;

create or replace function public.proposal_draft_content_identity_echo_slice_v1(
  p_echo jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'company_name', nullif(trim(coalesce(p_echo->>'company_name', '')), ''),
      'company_logo_url', nullif(trim(coalesce(p_echo->>'company_logo_url', '')), ''),
      'company_phone', nullif(trim(coalesce(p_echo->>'company_phone', '')), ''),
      'company_email', nullif(trim(coalesce(p_echo->>'company_email', '')), ''),
      'company_website', nullif(trim(coalesce(p_echo->>'company_website', '')), ''),
      'company_address', nullif(trim(coalesce(p_echo->>'company_address', '')), ''),
      'customer_name', nullif(trim(coalesce(p_echo->>'customer_name', '')), ''),
      'customer_email', nullif(trim(coalesce(p_echo->>'customer_email', '')), ''),
      'customer_phone', nullif(trim(coalesce(p_echo->>'customer_phone', '')), ''),
      'customer_address', nullif(trim(coalesce(p_echo->>'customer_address', '')), ''),
      'address_formatted', nullif(trim(coalesce(p_echo->>'address_formatted', '')), ''),
      'job_name', nullif(trim(coalesce(p_echo->>'job_name', '')), ''),
      'template_name', nullif(trim(coalesce(p_echo->>'template_name', '')), ''),
      'proposal_number', nullif(trim(coalesce(p_echo->>'proposal_number', '')), ''),
      'proposal_title', nullif(trim(coalesce(p_echo->>'proposal_title', '')), '')
    )
  );
$$;

create or replace function public.proposal_draft_vs_sent_graph_outcome_v1(
  p_company_id uuid,
  p_proposal_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_draft public.proposal_versions%rowtype;
  v_sent public.proposal_versions%rowtype;
  v_dup integer;
  v_unmatched integer;
  v_diff integer;
begin
  select p.*
    into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id;

  if not found then
    return 'unknown';
  end if;

  if v_proposal.latest_sent_version_id is null then
    return 'unsent';
  end if;

  if v_proposal.current_draft_version_id is null then
    return 'unknown';
  end if;

  select pv.*
    into v_draft
  from public.proposal_versions pv
  where pv.id = v_proposal.current_draft_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found or v_draft.version_kind is distinct from 'draft' then
    return 'unknown';
  end if;

  select pv.*
    into v_sent
  from public.proposal_versions pv
  where pv.id = v_proposal.latest_sent_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found or v_sent.version_kind not in ('sent', 'signed') or v_sent.frozen_at is null then
    return 'unknown';
  end if;

  -- Identity echo + full persisted policy/context snapshot (no live Catalog).
  if public.proposal_draft_content_identity_echo_slice_v1(v_draft.context_echo)
       is distinct from public.proposal_draft_content_identity_echo_slice_v1(v_sent.context_echo)
     or v_draft.policy_echo is distinct from v_sent.policy_echo
     or coalesce(v_draft.context_echo - array[
          'company_name','company_logo_url','company_phone','company_email','company_website',
          'company_address','customer_name','customer_email','customer_phone','customer_address',
          'address_formatted','job_name','template_name','proposal_number','proposal_title'
        ], '{}'::jsonb)
        is distinct from
        coalesce(v_sent.context_echo - array[
          'company_name','company_logo_url','company_phone','company_email','company_website',
          'company_address','customer_name','customer_email','customer_phone','customer_address',
          'address_formatted','job_name','template_name','proposal_number','proposal_title'
        ], '{}'::jsonb) then
    return 'dirty';
  end if;

  -- Package key collisions → unknown. Count mismatch after unique keys → dirty.
  select count(*)
    into v_dup
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    group by 1
    having count(*) > 1
    union all
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    group by 1
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  select count(*)
    into v_unmatched
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    except
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
  ) u;

  if v_unmatched > 0 then
    return 'dirty';
  end if;

  select count(*)
    into v_unmatched
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    except
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
  ) u;

  if v_unmatched > 0 then
    return 'dirty';
  end if;

  -- Selected package identity: source_template_option_id / sort key, not raw UUIDs.
  if (
    select public.proposal_draft_content_backfill_package_key_v1(d.source_template_option_id, d.sort_order)
    from public.proposal_options d
    where d.company_id = p_company_id
      and d.id = v_proposal.selected_option_id
      and d.proposal_version_id = v_draft.id
  ) is distinct from coalesce(
    (
      select public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
      from public.proposal_options s
      where s.company_id = p_company_id
        and s.proposal_version_id = v_sent.id
        and s.selected_at is not null
      order by s.selected_at desc
      limit 1
    ),
    (
      select public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
      from public.proposal_options s
      where s.company_id = p_company_id
        and s.proposal_version_id = v_sent.id
        and s.is_default
      order by s.sort_order
      limit 1
    )
  ) then
    return 'dirty';
  end if;

  select count(*)
    into v_diff
  from public.proposal_options d
  join public.proposal_options s
    on s.company_id = d.company_id
   and s.proposal_version_id = v_sent.id
   and public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
     = public.proposal_draft_content_backfill_package_key_v1(d.source_template_option_id, d.sort_order)
  where d.company_id = p_company_id
    and d.proposal_version_id = v_draft.id
    and (
      d.name is distinct from s.name
      or d.customer_label is distinct from s.customer_label
      or d.description is distinct from s.description
      or d.visible_to_customer is distinct from s.visible_to_customer
      or d.customer_subtotal_cents is distinct from s.customer_subtotal_cents
      or d.discount_cents is distinct from s.discount_cents
      or d.sales_tax_cents is distinct from s.sales_tax_cents
      or d.customer_total_cents is distinct from s.customer_total_cents
      or d.pricing_complete is distinct from s.pricing_complete
      or d.blocking_line_count is distinct from s.blocking_line_count
    );

  if v_diff > 0 then
    return 'dirty';
  end if;

  -- Pages: page_type + source_template_section_id + sort_order. Collision → unknown.
  select count(*)
    into v_dup
  from (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    group by 1, 2, 3
    having count(*) > 1
    union all
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    group by 1, 2, 3
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  -- EXCEPT treats NULLs as equal. Do not use outer joins on nullable keys;
  -- this Postgres rejects those as non merge/hash-joinable conditions.
  if exists (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    except
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
  ) or exists (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    except
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_pages d
    join public.proposal_pages s
      on s.company_id = p_company_id
     and s.proposal_version_id = v_sent.id
     and s.page_type is not distinct from d.page_type
     and s.source_template_section_id is not distinct from d.source_template_section_id
     and s.sort_order is not distinct from d.sort_order
    where d.company_id = p_company_id
      and d.proposal_version_id = v_draft.id
      and (
        d.title is distinct from s.title
        or d.customer_title is distinct from s.customer_title
        or d.visible_to_customer is distinct from s.visible_to_customer
        or d.content_json is distinct from s.content_json
        or d.settings_json is distinct from s.settings_json
      )
  ) then
    return 'dirty';
  end if;

  -- Lines: package key + source_template_item_id + catalog_seed_key + slot + sort_order.
  select count(*)
    into v_dup
  from (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order) as pkg,
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
    group by 1, 2, 3, 4, 5
    having count(*) > 1
    union all
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
    group by 1, 2, 3, 4, 5
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  if exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
  ) or exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_line_items dli
    join public.proposal_options dpo
      on dpo.id = dli.proposal_option_id
     and dpo.company_id = dli.company_id
    join public.proposal_options spo
      on spo.company_id = dpo.company_id
     and spo.proposal_version_id = v_sent.id
     and public.proposal_draft_content_backfill_package_key_v1(spo.source_template_option_id, spo.sort_order)
       = public.proposal_draft_content_backfill_package_key_v1(dpo.source_template_option_id, dpo.sort_order)
    join public.proposal_line_items sli
      on sli.company_id = dli.company_id
     and sli.proposal_option_id = spo.id
     and sli.source_template_item_id is not distinct from dli.source_template_item_id
     and sli.catalog_seed_key is not distinct from dli.catalog_seed_key
     and sli.composition_slot_key is not distinct from dli.composition_slot_key
     and sli.sort_order is not distinct from dli.sort_order
    where dli.company_id = p_company_id
      and dpo.proposal_version_id = v_draft.id
      and (
        dli.customer_name is distinct from sli.customer_name
        or dli.description is distinct from sli.description
        or dli.quantity is distinct from sli.quantity
        or dli.unit is distinct from sli.unit
        or dli.customer_unit_price_cents is distinct from sli.customer_unit_price_cents
        or dli.customer_line_total_cents is distinct from sli.customer_line_total_cents
        or dli.visible_to_customer is distinct from sli.visible_to_customer
        or dli.composition_role is distinct from sli.composition_role
        or dli.upgrade_selection_state is distinct from sli.upgrade_selection_state
        or dli.upgrade_effect is distinct from sli.upgrade_effect
        or dli.replaces_source_template_item_id is distinct from sli.replaces_source_template_item_id
        or dli.quantity_resolution_echo is distinct from sli.quantity_resolution_echo
      )
  ) then
    return 'dirty';
  end if;

  -- Upgrade choices: package key + source_template_item_id. Collision → unknown.
  select count(*)
    into v_dup
  from (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order) as pkg,
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
    group by 1, 2
    having count(*) > 1
    union all
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
    group by 1, 2
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  if exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
  ) or exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_option_upgrade_choices dc
    join public.proposal_options dpo
      on dpo.id = dc.proposal_option_id
     and dpo.company_id = dc.company_id
    join public.proposal_options spo
      on spo.company_id = dpo.company_id
     and spo.proposal_version_id = v_sent.id
     and public.proposal_draft_content_backfill_package_key_v1(spo.source_template_option_id, spo.sort_order)
       = public.proposal_draft_content_backfill_package_key_v1(dpo.source_template_option_id, dpo.sort_order)
    join public.proposal_option_upgrade_choices sc
      on sc.company_id = dc.company_id
     and sc.proposal_option_id = spo.id
     and sc.source_template_item_id is not distinct from dc.source_template_item_id
    where dc.company_id = p_company_id
      and dc.proposal_version_id = v_draft.id
      and (
        dc.selection_state is distinct from sc.selection_state
        or dc.upgrade_effect is distinct from sc.upgrade_effect
        or dc.replaces_source_template_item_id is distinct from sc.replaces_source_template_item_id
      )
  ) then
    return 'dirty';
  end if;

  -- Scope-decision adjunct: not copied to sent. Post-freeze scope/draft_saved → dirty.
  if exists (
    select 1
    from public.proposal_events freeze_ev
    where freeze_ev.company_id = p_company_id
      and freeze_ev.proposal_id = p_proposal_id
      and freeze_ev.proposal_version_id = v_sent.id
      and freeze_ev.event_type = 'snapshot_frozen'
      and (
        exists (
          select 1
          from public.proposal_events saved
          where saved.company_id = p_company_id
            and saved.proposal_id = p_proposal_id
            and saved.event_type = 'draft_saved'
            and saved.occurred_at > freeze_ev.occurred_at
        )
        or exists (
          select 1
          from public.proposal_option_scope_decisions sd
          where sd.company_id = p_company_id
            and sd.proposal_id = p_proposal_id
            and sd.proposal_version_id = v_draft.id
            and sd.updated_at > freeze_ev.occurred_at
        )
      )
  ) then
    return 'dirty';
  end if;

  return 'clean';
end;
$$;

revoke all on function public.proposal_draft_vs_sent_graph_outcome_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_draft_vs_sent_graph_outcome_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_draft_vs_sent_graph_outcome_v1(uuid, uuid)
  from authenticated;

create or replace function public.proposal_draft_content_changed_at_backfill_stamp_v1(
  p_company_id uuid,
  p_proposal_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_outcome text;
  v_proposal public.proposals%rowtype;
  v_frozen_at timestamptz;
  v_saved_at timestamptz;
  v_freeze_event_at timestamptz;
begin
  select p.*
    into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id;

  if not found then
    return now();
  end if;

  v_outcome := public.proposal_draft_vs_sent_graph_outcome_v1(p_company_id, p_proposal_id);

  if v_outcome = 'unsent' then
    return coalesce(v_proposal.created_at, now());
  end if;

  select pv.frozen_at
    into v_frozen_at
  from public.proposal_versions pv
  where pv.id = v_proposal.latest_sent_version_id
    and pv.company_id = p_company_id;

  if v_outcome = 'clean' then
    -- Baseline clamp. Not a claim that content changed at freeze.
    -- Must use frozen_at, never snapshot_frozen.created_at (DB clock is after Node frozen_at).
    return v_frozen_at;
  end if;

  -- dirty or unknown → stamp must be > frozen_at when a freeze exists.
  select max(e.occurred_at)
    into v_freeze_event_at
  from public.proposal_events e
  where e.company_id = p_company_id
    and e.proposal_id = p_proposal_id
    and e.proposal_version_id = v_proposal.latest_sent_version_id
    and e.event_type = 'snapshot_frozen';

  select max(e.occurred_at)
    into v_saved_at
  from public.proposal_events e
  where e.company_id = p_company_id
    and e.proposal_id = p_proposal_id
    and e.event_type = 'draft_saved'
    and (v_freeze_event_at is null or e.occurred_at > v_freeze_event_at);

  if v_outcome = 'dirty' and v_saved_at is not null and (v_frozen_at is null or v_saved_at > v_frozen_at) then
    return v_saved_at;
  end if;

  return now();
end;
$$;

revoke all on function public.proposal_draft_content_changed_at_backfill_stamp_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_draft_content_changed_at_backfill_stamp_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_draft_content_changed_at_backfill_stamp_v1(uuid, uuid)
  from authenticated;

-- Apply backfill as table owner (bypasses authenticated column REVOKE).
-- Disable the client-guard revert by using the internal GUC via a definer update.

create or replace function public.proposal_apply_draft_content_changed_at_backfill_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  perform set_config('proposal.allow_draft_content_changed_at_touch', '1', true);

  for v_row in
    select p.company_id, p.id
    from public.proposals p
  loop
    update public.proposals
    set draft_content_changed_at =
      public.proposal_draft_content_changed_at_backfill_stamp_v1(v_row.company_id, v_row.id)
    where company_id = v_row.company_id
      and id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.proposal_apply_draft_content_changed_at_backfill_v1()
  from public;
revoke all on function public.proposal_apply_draft_content_changed_at_backfill_v1()
  from anon;
revoke all on function public.proposal_apply_draft_content_changed_at_backfill_v1()
  from authenticated;

select public.proposal_apply_draft_content_changed_at_backfill_v1();

alter table public.proposals
  alter column draft_content_changed_at set default now();

update public.proposals
set draft_content_changed_at = coalesce(draft_content_changed_at, created_at, now())
where draft_content_changed_at is null;

alter table public.proposals
  alter column draft_content_changed_at set not null;


-- ---------------------------------------------------------------------------
-- 13. persist_draft_proposal_create_v1 — live 036 body + create clock
-- ---------------------------------------------------------------------------

create or replace function public.persist_draft_proposal_create_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_job_id uuid;
  v_customer_id uuid;
  v_template_id uuid;
  v_measurement_record_id uuid;
  v_pricing_policy_id uuid;
  v_title text;
  v_created_by uuid;
  v_proposal_id uuid;
  v_version_id uuid;
  v_selected_option_id uuid;
  v_selected_template_option_id uuid;
  v_page_count integer := 0;
  v_option_count integer := 0;
  page jsonb;
  opt jsonb;
  line jsonb;
  v_page_id uuid;
  v_option_id uuid;
  v_section_id uuid;
  v_section_to_page jsonb := '{}'::jsonb;
  v_template_to_option jsonb := '{}'::jsonb;
  v_event jsonb;
  v_set_job_active boolean;
begin
  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_job_id := nullif(trim(p_payload->>'job_id'), '')::uuid;
  v_template_id := nullif(trim(p_payload->>'template_id'), '')::uuid;
  v_pricing_policy_id := nullif(trim(p_payload->>'pricing_policy_id'), '')::uuid;

  if v_company_id is null or v_job_id is null or v_template_id is null or v_pricing_policy_id is null then
    raise exception 'company_id, job_id, template_id, and pricing_policy_id are required UUIDs';
  end if;

  v_customer_id := nullif(trim(p_payload->>'customer_id'), '')::uuid;
  v_measurement_record_id := nullif(trim(p_payload->>'measurement_record_id'), '')::uuid;
  v_created_by := nullif(trim(p_payload->>'created_by'), '')::uuid;
  v_title := nullif(trim(p_payload->>'title'), '');

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

  if not exists (
    select 1
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
  ) then
    raise exception 'Job not found for company';
  end if;

  if v_customer_id is not null and not exists (
    select 1
    from public.customers c
    where c.id = v_customer_id
      and c.company_id = v_company_id
  ) then
    raise exception 'Customer not found for company';
  end if;

  if not exists (
    select 1
    from public.proposal_templates pt
    where pt.id = v_template_id
      and pt.company_id = v_company_id
  ) then
    raise exception 'Template not found for company';
  end if;

  if not exists (
    select 1
    from public.company_pricing_policies cpp
    where cpp.id = v_pricing_policy_id
      and cpp.company_id = v_company_id
  ) then
    raise exception 'Pricing policy not found for company';
  end if;

  insert into public.proposals (
    company_id,
    job_id,
    customer_id,
    template_id,
    status,
    measurement_record_id,
    pricing_policy_id,
    title,
    created_by,
    draft_content_changed_at
  ) values (
    v_company_id,
    v_job_id,
    v_customer_id,
    v_template_id,
    'draft',
    v_measurement_record_id,
    v_pricing_policy_id,
    v_title,
    v_created_by,
    now()
  )
  returning id into v_proposal_id;

  insert into public.proposal_versions (
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
    v_company_id,
    v_proposal_id,
    1,
    'draft',
    null,
    null,
    coalesce(p_payload->'context_echo', '{}'::jsonb),
    coalesce(p_payload->'policy_echo', '{}'::jsonb),
    v_created_by
  )
  returning id into v_version_id;

  for page in
    select value
    from jsonb_array_elements(coalesce(p_payload->'pages', '[]'::jsonb))
  loop
    insert into public.proposal_pages (
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
      v_company_id,
      v_version_id,
      coalesce(nullif(page->>'page_type', ''), 'custom_text'),
      coalesce(nullif(page->>'sort_order', '')::integer, 0),
      coalesce(nullif(page->>'title', ''), 'Page'),
      nullif(page->>'customer_title', ''),
      coalesce((page->>'visible_to_customer')::boolean, true),
      nullif(page->>'source_template_section_id', '')::uuid,
      coalesce(page->'content_json', '{}'::jsonb),
      coalesce(page->'settings_json', '{}'::jsonb)
    )
    returning id into v_page_id;

    v_page_count := v_page_count + 1;

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
      description,
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
      v_version_id,
      nullif(opt->>'source_template_option_id', '')::uuid,
      coalesce(nullif(opt->>'name', ''), 'Option'),
      nullif(opt->>'customer_label', ''),
      nullif(opt->>'description', ''),
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

    v_template_to_option := v_template_to_option || jsonb_build_object(
      opt->>'source_template_option_id',
      v_option_id::text
    );

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      v_section_id := nullif(line->>'section_id', '')::uuid;
      v_page_id := null;

      if v_section_id is not null then
        if v_section_to_page ? v_section_id::text then
          v_page_id := (v_section_to_page->>v_section_id::text)::uuid;
        else
          raise exception 'Line section_id % does not map to an inserted page', v_section_id;
        end if;
      end if;

      insert into public.proposal_line_items (
        company_id,
        proposal_option_id,
        source_template_item_id,
        catalog_item_id,
        catalog_seed_key,
        composition_role,
        composition_slot_key,
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
        measurement_quantity_key,
        quantity_resolution_echo,
        upgrade_selection_state,
        upgrade_effect,
        replaces_source_template_item_id
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'composition_role', ''),
        nullif(line->>'composition_slot_key', ''),
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
        nullif(line->>'measurement_quantity_key', ''),
        case
          when jsonb_typeof(line->'quantity_resolution_echo') = 'object'
            then line->'quantity_resolution_echo'
          else null
        end,
        nullif(line->>'upgrade_selection_state', ''),
        nullif(line->>'upgrade_effect', ''),
        nullif(line->>'replaces_source_template_item_id', '')::uuid
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

    insert into public.proposal_option_upgrade_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      source_template_item_id,
      selection_state,
      upgrade_effect,
      replaces_source_template_item_id,
      created_by,
      updated_by
    )
    select
      v_company_id,
      v_proposal_id,
      v_version_id,
      v_option_id,
      nullif(trim(choice.value->>'source_template_item_id'), '')::uuid,
      nullif(trim(choice.value->>'selection_state'), ''),
      nullif(trim(choice.value->>'upgrade_effect'), ''),
      nullif(trim(choice.value->>'replaces_source_template_item_id'), '')::uuid,
      v_created_by,
      v_created_by
    from jsonb_array_elements(coalesce(opt->'upgrade_choices', '[]'::jsonb)) as choice(value)
    where nullif(trim(choice.value->>'source_template_item_id'), '') is not null;
  end loop;

  v_selected_template_option_id := nullif(trim(p_payload->>'selected_source_template_option_id'), '')::uuid;

  if v_selected_template_option_id is not null
    and v_template_to_option ? v_selected_template_option_id::text
  then
    v_selected_option_id := (v_template_to_option->>v_selected_template_option_id::text)::uuid;
  else
    select po.id
      into v_selected_option_id
    from public.proposal_options po
    where po.company_id = v_company_id
      and po.proposal_version_id = v_version_id
      and po.is_default = true
    order by po.sort_order
    limit 1;

    if v_selected_option_id is null then
      select po.id
        into v_selected_option_id
      from public.proposal_options po
      where po.company_id = v_company_id
        and po.proposal_version_id = v_version_id
      order by po.sort_order
      limit 1;
    end if;
  end if;

  update public.proposals
  set
    current_draft_version_id = v_version_id,
    selected_option_id = v_selected_option_id
  where id = v_proposal_id
    and company_id = v_company_id;

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
      coalesce(nullif(v_event->>'event_type', ''), 'created'),
      nullif(v_event->>'actor_user_id', '')::uuid,
      coalesce(v_event->'payload_json', '{}'::jsonb)
    );
  end if;

  v_set_job_active := coalesce((p_payload->>'set_job_active_proposal')::boolean, false);
  if v_set_job_active then
    update public.jobs
    set active_proposal_id = v_proposal_id
    where id = v_job_id
      and company_id = v_company_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_version_id,
    'selected_option_id', v_selected_option_id,
    'page_count', v_page_count,
    'option_count', v_option_count
  );
end;
$$;

comment on function public.persist_draft_proposal_create_v1(jsonb) is
  'Atomically persists a pre-built draft proposal create payload (proposal, version, pages, options, lines, summaries, upgrade choices, event). Initializes draft_content_changed_at = now().';

revoke all on function public.persist_draft_proposal_create_v1(jsonb) from public;
grant execute on function public.persist_draft_proposal_create_v1(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. persist_draft_pricing_refresh_v1 — live 036 body (pricing math unchanged)
-- Draft-scoped child/header triggers advance draft_content_changed_at in this
-- same transaction. This RPC is SECURITY INVOKER and must not SET the protected
-- column; authenticated cannot UPDATE it.
-- ---------------------------------------------------------------------------

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
        composition_role,
        composition_slot_key,
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
        measurement_quantity_key,
        quantity_resolution_echo,
        upgrade_selection_state,
        upgrade_effect,
        replaces_source_template_item_id
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'composition_role', ''),
        nullif(line->>'composition_slot_key', ''),
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
        nullif(line->>'measurement_quantity_key', ''),
        case
          when jsonb_typeof(line->'quantity_resolution_echo') = 'object'
            then line->'quantity_resolution_echo'
          else null
        end,
        nullif(line->>'upgrade_selection_state', ''),
        nullif(line->>'upgrade_effect', ''),
        nullif(line->>'replaces_source_template_item_id', '')::uuid
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

    insert into public.proposal_option_upgrade_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      source_template_item_id,
      selection_state,
      upgrade_effect,
      replaces_source_template_item_id
    )
    select
      v_company_id,
      v_proposal_id,
      v_version_id,
      v_option_id,
      nullif(trim(choice.value->>'source_template_item_id'), '')::uuid,
      nullif(trim(choice.value->>'selection_state'), ''),
      nullif(trim(choice.value->>'upgrade_effect'), ''),
      nullif(trim(choice.value->>'replaces_source_template_item_id'), '')::uuid
    from jsonb_array_elements(coalesce(opt->'upgrade_choices', '[]'::jsonb)) as choice(value)
    where nullif(trim(choice.value->>'source_template_item_id'), '') is not null
    on conflict (company_id, proposal_option_id, source_template_item_id)
    do update set
      selection_state = excluded.selection_state,
      upgrade_effect = excluded.upgrade_effect,
      replaces_source_template_item_id = excluded.replaces_source_template_item_id,
      proposal_id = excluded.proposal_id,
      proposal_version_id = excluded.proposal_version_id,
      updated_at = now();
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
  'Atomically persists a pre-built draft pricing refresh payload (options, lines, summaries, upgrade choices upsert, measurement stamp, event). Draft-scoped triggers advance draft_content_changed_at. Does not change pricing math.';

revoke all on function public.persist_draft_pricing_refresh_v1(jsonb) from public;
grant execute on function public.persist_draft_pricing_refresh_v1(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 16. classify_proposal_acceptance_guard_v1 — live 040 body, dirty source only
-- ---------------------------------------------------------------------------

create or replace function public.classify_proposal_acceptance_guard_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid,
  p_proposal_option_id uuid,
  p_acceptance_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
  v_frozen record;
  v_canonical text;
  v_dirty boolean := false;
  v_conflict boolean := false;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id
    and p.job_id = p_job_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select pv.*
  into v_version
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'invalid_binding');
  end if;

  if v_version.version_kind not in ('sent', 'signed') or v_version.frozen_at is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'version_not_frozen');
  end if;

  select *
  into v_frozen
  from public.proposal_acceptance_frozen_selected_option_v1(
    p_company_id,
    p_proposal_version_id
  );

  if v_frozen.option_id is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_on_version');
  end if;

  if v_frozen.option_id is distinct from p_proposal_option_id then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_selected_frozen');
  end if;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  v_dirty := v_proposal.draft_content_changed_at > v_version.frozen_at;

  select exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = p_company_id
      and a.proposal_id = p_proposal_id
      and (p_acceptance_id is null or a.id <> p_acceptance_id)
      and (
        a.proposal_version_id is distinct from p_proposal_version_id
        or a.proposal_option_id is distinct from p_proposal_option_id
      )
  )
  into v_conflict;

  if v_job.status = 'lost' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'lost'
    );
  end if;

  if v_job.status = 'closed' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'closed'
    );
  end if;

  if v_canonical in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_already_approved'
    );
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  if v_canonical is distinct from 'proposal' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_not_in_proposal'
    );
  end if;

  if v_proposal.latest_sent_version_id is distinct from p_proposal_version_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'older_sent_version'
    );
  end if;

  if v_dirty then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'dirty_revision'
    );
  end if;

  if v_job.active_proposal_id is distinct from p_proposal_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'proposal_lineage_conflict'
    );
  end if;

  if v_conflict then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'conflicting_acceptance'
    );
  end if;

  if v_job.status is distinct from 'active' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'result', 'valid_clean',
    'reason', null
  );
end;
$$;

revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from public;
revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from anon;
revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from authenticated;
grant execute on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

comment on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) is
  'R3C shared acceptance guard. valid_clean = latest frozen sent version, clean draft, '
  'active Proposal-stage job, matching frozen selected package, unambiguous. '
  'Dirty revision uses proposals.draft_content_changed_at > sent.frozen_at. '
  'valid_review_required = valid historical/contextual acceptance needing contractor context, '
  'including later acceptance after Approved/Scheduled/Production/Complete '
  '(reason job_already_approved). Neither result moves Job stage. Invalid is not recorded. '
  'Lost/closed are classified before later-stage so disposition remains visible.';

commit;
