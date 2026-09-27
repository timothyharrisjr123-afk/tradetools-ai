-- Phase 13B-C — capability- and scope-aware RLS on family-A policies.
--
-- Every Phase 13B-B family-A policy keeps its tenant predicate
-- (company_id = private.current_active_company_id()) and non-membership conjuncts
-- verbatim, and gains a capability predicate evaluated by the single evaluator:
--   ( SELECT private.member_can_v1('<cap>') )                      company scope
--   OR job_id = ANY (( SELECT private.member_job_ids_v1('<cap>') ))  Field job scope
-- Both helpers are argument-free per statement (init-plans), so scope is applied
-- before pagination, counts, search, and aggregation.
--
-- Field (job scope): jobs, job_tasks, job_schedules, job_attachments,
-- measurement_records on granted jobs only. No Field access to customers,
-- properties, proposals, estimates, templates, pricing/catalog, payments, scope
-- changes, activity, or attention; the Field Job Card reads job-linked contact,
-- schedule, and approved-scope summaries through get_job_field_brief_v1.
--
-- company_payment_accounts / company_payment_settings stay readable to
-- proposals.write: send-readiness (charges_enabled) and deposit-term defaults are
-- authoring prerequisites (no balances, transactions, or history).
-- companies (SELECT) and company_branding_profiles (SELECT) are unchanged; family-D
-- policies (self profile/membership, custody company update, write deny) are
-- untouched.

-- catalog_items DELETE
alter policy "catalog_items_delete_company_scope" on public.catalog_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- catalog_items INSERT
alter policy "catalog_items_insert_company_scope" on public.catalog_items
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- catalog_items SELECT
alter policy "catalog_items_select_company_scope" on public.catalog_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1)));

-- catalog_items UPDATE
alter policy "catalog_items_update_company_scope" on public.catalog_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- company_branding_profiles INSERT
alter policy "company_branding_profiles_insert_company_scope" on public.company_branding_profiles
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('company.manage'::text) AS member_can_v1));

-- company_branding_profiles UPDATE
alter policy "company_branding_profiles_update_company_scope" on public.company_branding_profiles
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('company.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('company.manage'::text) AS member_can_v1));

-- company_payment_accounts SELECT
alter policy "company_payment_accounts_select_company_scope" on public.company_payment_accounts
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('payments.configure'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('payments.request'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1)));

-- company_payment_settings SELECT
alter policy "company_payment_settings_select_company_scope" on public.company_payment_settings
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('payments.configure'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('payments.request'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1)));

-- company_pricing_policies DELETE
alter policy "company_pricing_policies_delete_company_scope" on public.company_pricing_policies
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- company_pricing_policies INSERT
alter policy "company_pricing_policies_insert_company_scope" on public.company_pricing_policies
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- company_pricing_policies SELECT
alter policy "company_pricing_policies_select_company_scope" on public.company_pricing_policies
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1)));

-- company_pricing_policies UPDATE
alter policy "company_pricing_policies_update_company_scope" on public.company_pricing_policies
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- company_template_preferences DELETE
alter policy "company_template_preferences_delete_company_scope" on public.company_template_preferences
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- company_template_preferences INSERT
alter policy "company_template_preferences_insert_company_scope" on public.company_template_preferences
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- company_template_preferences SELECT
alter policy "company_template_preferences_select_company_scope" on public.company_template_preferences
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1)));

-- company_template_preferences UPDATE
alter policy "company_template_preferences_update_company_scope" on public.company_template_preferences
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- customers DELETE
alter policy "customers_delete_company_scope" on public.customers
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- customers INSERT
alter policy "customers_insert_company_scope" on public.customers
  to authenticated
  with check ((((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- customers SELECT
alter policy "customers_select_company_scope" on public.customers
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.read'::text) AS member_can_v1));

-- customers UPDATE
alter policy "customers_update_company_scope" on public.customers
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1))
  with check ((((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- estimates DELETE
alter policy "Users can delete their company estimates" on public.estimates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- estimates INSERT
alter policy "Users can insert estimates for their company" on public.estimates
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- estimates SELECT
alter policy "Users can view their company estimates" on public.estimates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- estimates UPDATE
alter policy "Users can update their company estimates" on public.estimates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- job_activity_events SELECT
alter policy "job_activity_events_select_company_scope" on public.job_activity_events
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1));

-- job_attachments INSERT
alter policy "job_attachments_insert_company_scope" on public.job_attachments
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_attachments.job_id) AND (j.company_id = job_attachments.company_id)))))) AND (( SELECT private.member_can_v1('photos.contribute'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('photos.contribute'::text) AS member_job_ids_v1))::uuid[]))));

-- job_attachments SELECT
alter policy "job_attachments_select_company_scope" on public.job_attachments
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('jobs.read'::text) AS member_job_ids_v1))::uuid[]))));

-- job_attachments UPDATE
alter policy "job_attachments_update_company_scope" on public.job_attachments
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('photos.contribute'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('photos.contribute'::text) AS member_job_ids_v1))::uuid[]))))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_attachments.job_id) AND (j.company_id = job_attachments.company_id)))))) AND (( SELECT private.member_can_v1('photos.contribute'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('photos.contribute'::text) AS member_job_ids_v1))::uuid[]))));

-- job_attention_items SELECT
alter policy "job_attention_items_select_company_scope" on public.job_attention_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1));

-- job_attention_user_state SELECT
alter policy "job_attention_user_state_select_own" on public.job_attention_user_state
  to authenticated
  using ((((user_id = auth.uid()) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1));

-- job_payment_refund_event_receipts SELECT
alter policy "job_payment_refund_events_select_company_scope" on public.job_payment_refund_event_receipts
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('payments.history.read'::text) AS member_can_v1));

-- job_payment_refunds SELECT
alter policy "job_payment_refunds_select_company_scope" on public.job_payment_refunds
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('payments.history.read'::text) AS member_can_v1));

-- job_payment_request_delivery_attempts SELECT
alter policy "job_payment_request_delivery_attempts_select_company_scope" on public.job_payment_request_delivery_attempts
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('payments.summary.read'::text) AS member_can_v1));

-- job_payment_requests SELECT
alter policy "job_payment_requests_select_company_scope" on public.job_payment_requests
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('payments.summary.read'::text) AS member_can_v1));

-- job_payment_transactions SELECT
alter policy "job_payment_transactions_select_company_scope" on public.job_payment_transactions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('payments.history.read'::text) AS member_can_v1));

-- job_schedules SELECT
alter policy "job_schedules_select_company_scope" on public.job_schedules
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('schedule.read'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('schedule.read'::text) AS member_job_ids_v1))::uuid[]))));

-- job_scope_change_approvals SELECT
alter policy "job_scope_change_approvals_select_company_scope" on public.job_scope_change_approvals
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('scope_changes.write'::text) AS member_can_v1)));

-- job_scope_change_lines SELECT
alter policy "job_scope_change_lines_select_company_scope" on public.job_scope_change_lines
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('scope_changes.write'::text) AS member_can_v1)));

-- job_scope_change_public_access_tokens SELECT
alter policy "job_scope_change_public_access_tokens_select_company_scope" on public.job_scope_change_public_access_tokens
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('scope_changes.issue'::text) AS member_can_v1));

-- job_scope_changes SELECT
alter policy "job_scope_changes_select_company_scope" on public.job_scope_changes
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('scope_changes.write'::text) AS member_can_v1)));

-- job_tasks INSERT
alter policy "job_tasks_insert_company_scope" on public.job_tasks
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_tasks.job_id) AND (j.company_id = job_tasks.company_id)))))) AND (( SELECT private.member_can_v1('tasks.manage'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('tasks.manage'::text) AS member_job_ids_v1))::uuid[]))));

-- job_tasks SELECT
alter policy "job_tasks_select_company_scope" on public.job_tasks
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('tasks.read'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('tasks.read'::text) AS member_job_ids_v1))::uuid[]))));

-- job_tasks UPDATE
alter policy "job_tasks_update_company_scope" on public.job_tasks
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ((( SELECT private.member_can_v1('tasks.manage'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('tasks.manage'::text) AS member_job_ids_v1))::uuid[]))) OR ( SELECT private.member_can_v1('tasks.complete'::text) AS member_can_v1) OR ((assigned_to = ( SELECT auth.uid() AS uid)) AND private.member_can_v1('tasks.complete'::text, job_id, id))))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = job_tasks.job_id) AND (j.company_id = job_tasks.company_id)))))) AND ((( SELECT private.member_can_v1('tasks.manage'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('tasks.manage'::text) AS member_job_ids_v1))::uuid[]))) OR ( SELECT private.member_can_v1('tasks.complete'::text) AS member_can_v1) OR ((assigned_to = ( SELECT auth.uid() AS uid)) AND private.member_can_v1('tasks.complete'::text, job_id, id))));

-- jobs DELETE
alter policy "jobs_delete_company_scope" on public.jobs
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('jobs.manage'::text) AS member_can_v1));

-- jobs INSERT
alter policy "jobs_insert_company_scope" on public.jobs
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('jobs.manage'::text) AS member_can_v1));

-- jobs SELECT
alter policy "jobs_select_company_scope" on public.jobs
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1) OR (id = ANY ((( SELECT private.member_job_ids_v1('jobs.read'::text) AS member_job_ids_v1))::uuid[]))));

-- jobs UPDATE
alter policy "jobs_update_company_scope" on public.jobs
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('jobs.manage'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('jobs.assign'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1)))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('jobs.manage'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('jobs.assign'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1)));

-- measurement_records DELETE
alter policy "measurement_records_delete_company_scope" on public.measurement_records
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('measurements.capture'::text) AS member_can_v1));

-- measurement_records INSERT
alter policy "measurement_records_insert_company_scope" on public.measurement_records
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = measurement_records.job_id) AND (j.company_id = measurement_records.company_id))))) AND ((estimate_id IS NULL) OR (EXISTS ( SELECT 1 FROM estimates e WHERE ((e.id = measurement_records.estimate_id) AND (e.company_id = measurement_records.company_id))))))) AND (( SELECT private.member_can_v1('measurements.capture'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('measurements.capture'::text) AS member_job_ids_v1))::uuid[]))));

-- measurement_records SELECT
alter policy "measurement_records_select_company_scope" on public.measurement_records
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('jobs.read'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('jobs.read'::text) AS member_job_ids_v1))::uuid[]))));

-- measurement_records UPDATE
alter policy "measurement_records_update_company_scope" on public.measurement_records
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('measurements.capture'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('measurements.capture'::text) AS member_job_ids_v1))::uuid[]))))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = measurement_records.job_id) AND (j.company_id = measurement_records.company_id))))) AND ((estimate_id IS NULL) OR (EXISTS ( SELECT 1 FROM estimates e WHERE ((e.id = measurement_records.estimate_id) AND (e.company_id = measurement_records.company_id))))))) AND (( SELECT private.member_can_v1('measurements.capture'::text) AS member_can_v1) OR (job_id = ANY ((( SELECT private.member_job_ids_v1('measurements.capture'::text) AS member_job_ids_v1))::uuid[]))));

-- payments SELECT
alter policy "payments_select_company_scope" on public.payments
  to authenticated
  using ((((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('payments.history.read'::text) AS member_can_v1));

-- properties DELETE
alter policy "properties_delete_company_scope" on public.properties
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- properties INSERT
alter policy "properties_insert_company_scope" on public.properties
  to authenticated
  with check ((((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- properties SELECT
alter policy "properties_select_company_scope" on public.properties
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.read'::text) AS member_can_v1));

-- properties UPDATE
alter policy "properties_update_company_scope" on public.properties
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1))
  with check ((((company_id IS NOT NULL) AND ((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))))) AND ( SELECT private.member_can_v1('customers.manage'::text) AS member_can_v1));

-- proposal_acceptances SELECT
alter policy "proposal_acceptances_select_company_scope" on public.proposal_acceptances
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_customer_activity SELECT
alter policy "proposal_customer_activity_select_company_scope" on public.proposal_customer_activity
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_customer_requests SELECT
alter policy "proposal_customer_requests_select_company_scope" on public.proposal_customer_requests
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_delivery_attempts SELECT
alter policy "proposal_delivery_attempts_select_company_scope" on public.proposal_delivery_attempts
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_events INSERT
alter policy "proposal_events_insert_company_scope" on public.proposal_events
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_events SELECT
alter policy "proposal_events_select_company_scope" on public.proposal_events
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_internal_summaries DELETE
alter policy "proposal_internal_summaries_delete_company_scope" on public.proposal_internal_summaries
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_internal_summaries INSERT
alter policy "proposal_internal_summaries_insert_company_scope" on public.proposal_internal_summaries
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_internal_summaries SELECT
alter policy "proposal_internal_summaries_select_company_scope" on public.proposal_internal_summaries
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1)));

-- proposal_internal_summaries UPDATE
alter policy "proposal_internal_summaries_update_company_scope" on public.proposal_internal_summaries
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_line_items DELETE
alter policy "proposal_line_items_delete_company_scope" on public.proposal_line_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_line_items INSERT
alter policy "proposal_line_items_insert_company_scope" on public.proposal_line_items
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_line_items SELECT
alter policy "proposal_line_items_select_company_scope" on public.proposal_line_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_line_items UPDATE
alter policy "proposal_line_items_update_company_scope" on public.proposal_line_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_scope_decisions DELETE
alter policy "proposal_option_scope_decisions_delete_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_scope_decisions INSERT
alter policy "proposal_option_scope_decisions_insert_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_scope_decisions SELECT
alter policy "proposal_option_scope_decisions_select_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_option_scope_decisions UPDATE
alter policy "proposal_option_scope_decisions_update_company_scope" on public.proposal_option_scope_decisions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_upgrade_choices DELETE
alter policy "proposal_option_upgrade_choices_delete_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_upgrade_choices INSERT
alter policy "proposal_option_upgrade_choices_insert_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_option_upgrade_choices SELECT
alter policy "proposal_option_upgrade_choices_select_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_option_upgrade_choices UPDATE
alter policy "proposal_option_upgrade_choices_update_company_scope" on public.proposal_option_upgrade_choices
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_options DELETE
alter policy "proposal_options_delete_company_scope" on public.proposal_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_options INSERT
alter policy "proposal_options_insert_company_scope" on public.proposal_options
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_options SELECT
alter policy "proposal_options_select_company_scope" on public.proposal_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_options UPDATE
alter policy "proposal_options_update_company_scope" on public.proposal_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_pages DELETE
alter policy "proposal_pages_delete_company_scope" on public.proposal_pages
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_pages INSERT
alter policy "proposal_pages_insert_company_scope" on public.proposal_pages
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_pages SELECT
alter policy "proposal_pages_select_company_scope" on public.proposal_pages
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_pages UPDATE
alter policy "proposal_pages_update_company_scope" on public.proposal_pages
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_public_access_tokens SELECT
alter policy "proposal_public_access_tokens_select_company_scope" on public.proposal_public_access_tokens
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ( SELECT private.member_can_v1('proposals.send'::text) AS member_can_v1)));

-- proposal_public_option_choices SELECT
alter policy "proposal_public_option_choices_select_company_scope" on public.proposal_public_option_choices
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_signatures SELECT
alter policy "proposal_signatures_select_company_scope" on public.proposal_signatures
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_template_items DELETE
alter policy "proposal_template_items_delete_company_scope" on public.proposal_template_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_items INSERT
alter policy "proposal_template_items_insert_company_scope" on public.proposal_template_items
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_sections s WHERE ((s.id = proposal_template_items.section_id) AND (s.option_id = proposal_template_items.option_id) AND (s.template_id = proposal_template_items.template_id) AND (s.company_id = proposal_template_items.company_id)))) AND ((catalog_item_id IS NULL) OR (EXISTS ( SELECT 1 FROM catalog_items c WHERE ((c.id = proposal_template_items.catalog_item_id) AND (c.company_id = proposal_template_items.company_id))))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_items SELECT
alter policy "proposal_template_items_select_company_scope" on public.proposal_template_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1)));

-- proposal_template_items UPDATE
alter policy "proposal_template_items_update_company_scope" on public.proposal_template_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_sections s WHERE ((s.id = proposal_template_items.section_id) AND (s.option_id = proposal_template_items.option_id) AND (s.template_id = proposal_template_items.template_id) AND (s.company_id = proposal_template_items.company_id)))) AND ((catalog_item_id IS NULL) OR (EXISTS ( SELECT 1 FROM catalog_items c WHERE ((c.id = proposal_template_items.catalog_item_id) AND (c.company_id = proposal_template_items.company_id))))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_options DELETE
alter policy "proposal_template_options_delete_company_scope" on public.proposal_template_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_options INSERT
alter policy "proposal_template_options_insert_company_scope" on public.proposal_template_options
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposal_template_options.template_id) AND (t.company_id = proposal_template_options.company_id)))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_options SELECT
alter policy "proposal_template_options_select_company_scope" on public.proposal_template_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1)));

-- proposal_template_options UPDATE
alter policy "proposal_template_options_update_company_scope" on public.proposal_template_options
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposal_template_options.template_id) AND (t.company_id = proposal_template_options.company_id)))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_sections DELETE
alter policy "proposal_template_sections_delete_company_scope" on public.proposal_template_sections
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_sections INSERT
alter policy "proposal_template_sections_insert_company_scope" on public.proposal_template_sections
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_options o WHERE ((o.id = proposal_template_sections.option_id) AND (o.template_id = proposal_template_sections.template_id) AND (o.company_id = proposal_template_sections.company_id)))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_template_sections SELECT
alter policy "proposal_template_sections_select_company_scope" on public.proposal_template_sections
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1)));

-- proposal_template_sections UPDATE
alter policy "proposal_template_sections_update_company_scope" on public.proposal_template_sections
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND (EXISTS ( SELECT 1 FROM proposal_template_options o WHERE ((o.id = proposal_template_sections.option_id) AND (o.template_id = proposal_template_sections.template_id) AND (o.company_id = proposal_template_sections.company_id)))))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_templates DELETE
alter policy "proposal_templates_delete_company_scope" on public.proposal_templates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_templates INSERT
alter policy "proposal_templates_insert_company_scope" on public.proposal_templates
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_templates SELECT
alter policy "proposal_templates_select_company_scope" on public.proposal_templates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1)));

-- proposal_templates UPDATE
alter policy "proposal_templates_update_company_scope" on public.proposal_templates
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('templates.manage'::text) AS member_can_v1));

-- proposal_version_payment_terms SELECT
alter policy "proposal_version_payment_terms_select_company_scope" on public.proposal_version_payment_terms
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_versions DELETE
alter policy "proposal_versions_delete_company_scope" on public.proposal_versions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_versions INSERT
alter policy "proposal_versions_insert_company_scope" on public.proposal_versions
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposal_versions SELECT
alter policy "proposal_versions_select_company_scope" on public.proposal_versions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposal_versions UPDATE
alter policy "proposal_versions_update_company_scope" on public.proposal_versions
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposals DELETE
alter policy "proposals_delete_company_scope" on public.proposals
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposals INSERT
alter policy "proposals_insert_company_scope" on public.proposals
  to authenticated
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = proposals.job_id) AND (j.company_id = proposals.company_id))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposals.template_id) AND (t.company_id = proposals.company_id))))) AND ((measurement_record_id IS NULL) OR (EXISTS ( SELECT 1 FROM measurement_records m WHERE ((m.id = proposals.measurement_record_id) AND (m.company_id = proposals.company_id))))) AND ((pricing_policy_id IS NULL) OR (EXISTS ( SELECT 1 FROM company_pricing_policies p WHERE ((p.id = proposals.pricing_policy_id) AND (p.company_id = proposals.company_id))))))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- proposals SELECT
alter policy "proposals_select_company_scope" on public.proposals
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.read'::text) AS member_can_v1));

-- proposals UPDATE
alter policy "proposals_update_company_scope" on public.proposals
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1))
  with check (((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id))) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1 FROM jobs j WHERE ((j.id = proposals.job_id) AND (j.company_id = proposals.company_id))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1 FROM proposal_templates t WHERE ((t.id = proposals.template_id) AND (t.company_id = proposals.company_id))))) AND ((measurement_record_id IS NULL) OR (EXISTS ( SELECT 1 FROM measurement_records m WHERE ((m.id = proposals.measurement_record_id) AND (m.company_id = proposals.company_id))))) AND ((pricing_policy_id IS NULL) OR (EXISTS ( SELECT 1 FROM company_pricing_policies p WHERE ((p.id = proposals.pricing_policy_id) AND (p.company_id = proposals.company_id))))))) AND ( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1));

-- service_items DELETE
alter policy "service_items_delete_own_company" on public.service_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- service_items INSERT
alter policy "service_items_insert_own_company" on public.service_items
  to authenticated
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));

-- service_items SELECT
alter policy "service_items_select_own_company" on public.service_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND (( SELECT private.member_can_v1('proposals.write'::text) AS member_can_v1) OR ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1)));

-- service_items UPDATE
alter policy "service_items_update_own_company" on public.service_items
  to authenticated
  using ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1))
  with check ((((company_id = ( SELECT private.current_active_company_id() AS current_active_company_id)))) AND ( SELECT private.member_can_v1('pricing.manage'::text) AS member_can_v1));
