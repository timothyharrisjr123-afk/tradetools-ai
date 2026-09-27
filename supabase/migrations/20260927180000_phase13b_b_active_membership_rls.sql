-- Phase 13B-B — active-membership enforcement for tenant RLS (family A only).
--
-- Every employee/member (family A) policy previously authorized with
--   company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
-- which ignored removed_at, so a disabled member with an unexpired session kept
-- tenant access through PostgREST. Each such policy is rebuilt in place (same name,
-- same command, same non-membership conjuncts) against
-- private.current_active_company_id(), which derives the actor from auth.uid(),
-- requires removed_at IS NULL and a canonical role, and fails closed.
--
-- Reviewed inventory: docs/phase13b-b-policy-inventory.json (126 live policies:
-- 120 family A rebuilt here, 6 family D unchanged — self profile x3, self membership,
-- custody company update, explicit write deny). No policy carries public-token or
-- service authority; public customer flows use service-role routes and definer RPCs.
--
-- R15: proposal_public_access_tokens SELECT additionally requires proposal_author.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.role_is_valid_v1(p_role text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_role = any (array['owner', 'admin', 'office_sales', 'production_lead', 'field_user']);
$$;

-- Interim capability map (Phase 13B-A): only `owner` holds capabilities. Mirrors
-- app/lib/companyMembershipRoles.ts OWNER_CAPABILITIES; Phase C replaces the body.
create or replace function private.role_has_capability_v1(p_role text, p_capability text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_role = 'owner', false)
    and p_capability = any (array[
      'company_admin',
      'member_admin',
      'proposal_author',
      'payment_admin',
      'payment_request',
      'schedule_mutate',
      'task_assign',
      'task_complete',
      'lifecycle_start_complete',
      'photo_mutate',
      'job_assign',
      'customers_jobs',
      'job_pause_resume',
      'job_disposition_finalize',
      'job_approve'
    ]);
$$;

create or replace function private.current_active_company_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.company_id
  from public.company_memberships m
  where m.user_id = auth.uid()
    and m.removed_at is null
    and private.role_is_valid_v1(m.role)
  limit 1;
$$;

create or replace function private.current_member_has_capability_v1(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select private.role_has_capability_v1(m.role, p_capability)
    from public.company_memberships m
    where m.user_id = auth.uid()
      and m.removed_at is null
      and private.role_is_valid_v1(m.role)
    limit 1
  ), false);
$$;

revoke all on function private.role_is_valid_v1(text) from public;
revoke all on function private.role_has_capability_v1(text, text) from public;
revoke all on function private.current_active_company_id() from public;
revoke all on function private.current_member_has_capability_v1(text) from public;
grant execute on function private.role_is_valid_v1(text) to authenticated, service_role;
grant execute on function private.role_has_capability_v1(text, text) to authenticated, service_role;
grant execute on function private.current_active_company_id() to authenticated, service_role;
grant execute on function private.current_member_has_capability_v1(text) to authenticated, service_role;

-- Family A rebuild (generated from the reviewed inventory; see header).

alter policy "catalog_items_delete_company_scope" on public.catalog_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "catalog_items_insert_company_scope" on public.catalog_items
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "catalog_items_select_company_scope" on public.catalog_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "catalog_items_update_company_scope" on public.catalog_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "Users can view their company" on public.companies
  to authenticated
  using (((id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_branding_profiles_insert_company_scope" on public.company_branding_profiles
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_branding_profiles_select_company_scope" on public.company_branding_profiles
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_branding_profiles_update_company_scope" on public.company_branding_profiles
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_payment_accounts_select_company_scope" on public.company_payment_accounts
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_payment_settings_select_company_scope" on public.company_payment_settings
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_pricing_policies_delete_company_scope" on public.company_pricing_policies
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_pricing_policies_insert_company_scope" on public.company_pricing_policies
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_pricing_policies_select_company_scope" on public.company_pricing_policies
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_pricing_policies_update_company_scope" on public.company_pricing_policies
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_template_preferences_delete_company_scope" on public.company_template_preferences
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_template_preferences_insert_company_scope" on public.company_template_preferences
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_template_preferences_select_company_scope" on public.company_template_preferences
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "company_template_preferences_update_company_scope" on public.company_template_preferences
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "customers_delete_company_scope" on public.customers
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "customers_insert_company_scope" on public.customers
  to authenticated
  with check (((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "customers_select_company_scope" on public.customers
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "customers_update_company_scope" on public.customers
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "Users can delete their company estimates" on public.estimates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "Users can insert estimates for their company" on public.estimates
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "Users can view their company estimates" on public.estimates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "Users can update their company estimates" on public.estimates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_activity_events_select_company_scope" on public.job_activity_events
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_attachments_insert_company_scope" on public.job_attachments
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_attachments.job_id) AND (j.company_id = job_attachments.company_id))))));

alter policy "job_attachments_select_company_scope" on public.job_attachments
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_attachments_update_company_scope" on public.job_attachments
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_attachments.job_id) AND (j.company_id = job_attachments.company_id))))));

alter policy "job_attention_items_select_company_scope" on public.job_attention_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_attention_user_state_select_own" on public.job_attention_user_state
  to authenticated
  using (((user_id = auth.uid()) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "job_payment_refund_events_select_company_scope" on public.job_payment_refund_event_receipts
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_payment_refunds_select_company_scope" on public.job_payment_refunds
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_payment_request_delivery_attempts_select_company_scope" on public.job_payment_request_delivery_attempts
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_payment_requests_select_company_scope" on public.job_payment_requests
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_payment_transactions_select_company_scope" on public.job_payment_transactions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_schedules_select_company_scope" on public.job_schedules
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_scope_change_approvals_select_company_scope" on public.job_scope_change_approvals
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_scope_change_lines_select_company_scope" on public.job_scope_change_lines
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_scope_change_public_access_tokens_select_company_scope" on public.job_scope_change_public_access_tokens
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_scope_changes_select_company_scope" on public.job_scope_changes
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_tasks_insert_company_scope" on public.job_tasks
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_tasks.job_id) AND (j.company_id = job_tasks.company_id))))));

alter policy "job_tasks_select_company_scope" on public.job_tasks
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "job_tasks_update_company_scope" on public.job_tasks
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_tasks.job_id) AND (j.company_id = job_tasks.company_id))))));

alter policy "jobs_delete_company_scope" on public.jobs
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "jobs_insert_company_scope" on public.jobs
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "jobs_select_company_scope" on public.jobs
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "jobs_update_company_scope" on public.jobs
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "measurement_records_delete_company_scope" on public.measurement_records
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "measurement_records_insert_company_scope" on public.measurement_records
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = measurement_records.job_id) AND (j.company_id = measurement_records.company_id))))) AND ((estimate_id IS NULL) OR (EXISTS ( SELECT 1 FROM estimates e WHERE ((e.id = measurement_records.estimate_id) AND (e.company_id = measurement_records.company_id)))))));

alter policy "measurement_records_select_company_scope" on public.measurement_records
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "measurement_records_update_company_scope" on public.measurement_records
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = measurement_records.job_id) AND (j.company_id = measurement_records.company_id))))) AND ((estimate_id IS NULL) OR (EXISTS ( SELECT 1 FROM estimates e WHERE ((e.id = measurement_records.estimate_id) AND (e.company_id = measurement_records.company_id)))))));

alter policy "payments_select_company_scope" on public.payments
  to authenticated
  using (((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "properties_delete_company_scope" on public.properties
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "properties_insert_company_scope" on public.properties
  to authenticated
  with check (((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "properties_select_company_scope" on public.properties
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "properties_update_company_scope" on public.properties
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))));

alter policy "proposal_acceptances_select_company_scope" on public.proposal_acceptances
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_customer_activity_select_company_scope" on public.proposal_customer_activity
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_customer_requests_select_company_scope" on public.proposal_customer_requests
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_delivery_attempts_select_company_scope" on public.proposal_delivery_attempts
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_events_insert_company_scope" on public.proposal_events
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_events_select_company_scope" on public.proposal_events
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_internal_summaries_delete_company_scope" on public.proposal_internal_summaries
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_internal_summaries_insert_company_scope" on public.proposal_internal_summaries
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_internal_summaries_select_company_scope" on public.proposal_internal_summaries
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_internal_summaries_update_company_scope" on public.proposal_internal_summaries
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_line_items_delete_company_scope" on public.proposal_line_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_line_items_insert_company_scope" on public.proposal_line_items
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_line_items_select_company_scope" on public.proposal_line_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_line_items_update_company_scope" on public.proposal_line_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_scope_decisions_delete_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_scope_decisions_insert_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_scope_decisions_select_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_scope_decisions_update_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_upgrade_choices_delete_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_upgrade_choices_insert_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_upgrade_choices_select_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_option_upgrade_choices_update_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_options_delete_company_scope" on public.proposal_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_options_insert_company_scope" on public.proposal_options
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_options_select_company_scope" on public.proposal_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_options_update_company_scope" on public.proposal_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_pages_delete_company_scope" on public.proposal_pages
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_pages_insert_company_scope" on public.proposal_pages
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_pages_select_company_scope" on public.proposal_pages
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_pages_update_company_scope" on public.proposal_pages
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_public_access_tokens_select_company_scope" on public.proposal_public_access_tokens
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ( SELECT private.current_member_has_capability_v1('proposal_author'::text) AS current_member_has_capability_v1)));

alter policy "proposal_public_option_choices_select_company_scope" on public.proposal_public_option_choices
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_signatures_select_company_scope" on public.proposal_signatures
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_items_delete_company_scope" on public.proposal_template_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_items_insert_company_scope" on public.proposal_template_items
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_sections s WHERE ((s.id = proposal_template_items.section_id) AND (s.option_id = proposal_template_items.option_id) AND (s.template_id = proposal_template_items.template_id) AND (s.company_id = proposal_template_items.company_id)))) AND ((catalog_item_id IS NULL) OR (EXISTS ( SELECT 1 FROM catalog_items c WHERE ((c.id = proposal_template_items.catalog_item_id) AND (c.company_id = proposal_template_items.company_id)))))));

alter policy "proposal_template_items_select_company_scope" on public.proposal_template_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_items_update_company_scope" on public.proposal_template_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_sections s WHERE ((s.id = proposal_template_items.section_id) AND (s.option_id = proposal_template_items.option_id) AND (s.template_id = proposal_template_items.template_id) AND (s.company_id = proposal_template_items.company_id)))) AND ((catalog_item_id IS NULL) OR (EXISTS ( SELECT 1 FROM catalog_items c WHERE ((c.id = proposal_template_items.catalog_item_id) AND (c.company_id = proposal_template_items.company_id)))))));

alter policy "proposal_template_options_delete_company_scope" on public.proposal_template_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_options_insert_company_scope" on public.proposal_template_options
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposal_template_options.template_id) AND (t.company_id = proposal_template_options.company_id))))));

alter policy "proposal_template_options_select_company_scope" on public.proposal_template_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_options_update_company_scope" on public.proposal_template_options
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposal_template_options.template_id) AND (t.company_id = proposal_template_options.company_id))))));

alter policy "proposal_template_sections_delete_company_scope" on public.proposal_template_sections
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_sections_insert_company_scope" on public.proposal_template_sections
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_options o WHERE ((o.id = proposal_template_sections.option_id) AND (o.template_id = proposal_template_sections.template_id) AND (o.company_id = proposal_template_sections.company_id))))));

alter policy "proposal_template_sections_select_company_scope" on public.proposal_template_sections
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_template_sections_update_company_scope" on public.proposal_template_sections
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_options o WHERE ((o.id = proposal_template_sections.option_id) AND (o.template_id = proposal_template_sections.template_id) AND (o.company_id = proposal_template_sections.company_id))))));

alter policy "proposal_templates_delete_company_scope" on public.proposal_templates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_templates_insert_company_scope" on public.proposal_templates
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_templates_select_company_scope" on public.proposal_templates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_templates_update_company_scope" on public.proposal_templates
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_version_payment_terms_select_company_scope" on public.proposal_version_payment_terms
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_versions_delete_company_scope" on public.proposal_versions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_versions_insert_company_scope" on public.proposal_versions
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_versions_select_company_scope" on public.proposal_versions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposal_versions_update_company_scope" on public.proposal_versions
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposals_delete_company_scope" on public.proposals
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposals_insert_company_scope" on public.proposals
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = proposals.job_id) AND (j.company_id = proposals.company_id))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposals.template_id) AND (t.company_id = proposals.company_id))))) AND ((measurement_record_id IS NULL) OR (EXISTS ( SELECT 1 FROM measurement_records m WHERE ((m.id = proposals.measurement_record_id) AND (m.company_id = proposals.company_id))))) AND ((pricing_policy_id IS NULL) OR (EXISTS ( SELECT 1 FROM company_pricing_policies p WHERE ((p.id = proposals.pricing_policy_id) AND (p.company_id = proposals.company_id)))))));

alter policy "proposals_select_company_scope" on public.proposals
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "proposals_update_company_scope" on public.proposals
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = proposals.job_id) AND (j.company_id = proposals.company_id))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposals.template_id) AND (t.company_id = proposals.company_id))))) AND ((measurement_record_id IS NULL) OR (EXISTS ( SELECT 1 FROM measurement_records m WHERE ((m.id = proposals.measurement_record_id) AND (m.company_id = proposals.company_id))))) AND ((pricing_policy_id IS NULL) OR (EXISTS ( SELECT 1 FROM company_pricing_policies p WHERE ((p.id = proposals.pricing_policy_id) AND (p.company_id = proposals.company_id)))))));

alter policy "service_items_delete_own_company" on public.service_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "service_items_insert_own_company" on public.service_items
  to authenticated
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "service_items_select_own_company" on public.service_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));

alter policy "service_items_update_own_company" on public.service_items
  to authenticated
  using (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))
  with check (((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))));
