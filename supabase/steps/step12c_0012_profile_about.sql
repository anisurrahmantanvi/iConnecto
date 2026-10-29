-- STEP 12c: run this in the Supabase SQL editor (safe to run more than once). It adds the profile About details.
-- iConnecto 0012: "About" details on profiles (work, education, location, relationship status).
-- Users can edit only these columns (column-level grant, like bio/avatar). Reading is covered by the existing profiles SELECT grant.
-- Idempotent and non-destructive. "Joined" on the profile uses the existing created_at column.

alter table public.profiles add column if not exists work text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists relationship_status text;

select public._ic_add_constraint('public.profiles', 'profiles_work_len', $$check (work is null or char_length(work) <= 80) not valid$$);
select public._ic_add_constraint('public.profiles', 'profiles_education_len', $$check (education is null or char_length(education) <= 80) not valid$$);
select public._ic_add_constraint('public.profiles', 'profiles_location_len', $$check (location is null or char_length(location) <= 80) not valid$$);
select public._ic_add_constraint('public.profiles', 'profiles_relationship_status_chk',
  $$check (relationship_status is null or relationship_status in ('single', 'married')) not valid$$);

grant update (work, education, location, relationship_status) on public.profiles to authenticated;
