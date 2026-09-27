-- A consumed admission records the company it created. ON DELETE SET NULL cleared that
-- pointer while status stayed 'consumed', which the consumed check rejects, so the
-- company could not be deleted. Deleting the company removes the admission row.

alter table public.company_creator_admissions
  drop constraint company_creator_admissions_resulting_company_id_fkey;

alter table public.company_creator_admissions
  add constraint company_creator_admissions_resulting_company_id_fkey
  foreign key (resulting_company_id) references public.companies (id) on delete cascade;
