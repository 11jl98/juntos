-- Restrict this dedicated project to the couple's single household.
begin;

do $$
begin
  if (select count(*) from public.households) > 1 then
    raise exception 'Este projeto já contém mais de um espaço; revise os dados antes de aplicar esta migration.';
  end if;
end $$;

create table public.household_registry (
  singleton boolean primary key default true check (singleton),
  household_id uuid unique references public.households(id) on delete restrict
);

insert into public.household_registry(singleton, household_id)
values (true, (select id from public.households limit 1));

revoke all on public.household_registry from public, anon, authenticated;

create or replace function public.create_household(p_name text, p_document jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  h uuid;
  u uuid := auth.uid();
  existing_household uuid;
begin
  if u is null then raise exception 'Login necessário'; end if;

  select household_id into existing_household
  from public.household_registry
  where singleton = true
  for update;

  if existing_household is not null then
    raise exception 'Este projeto já tem o espaço do casal. Use o convite recebido.';
  end if;

  perform 1 from auth.users where id = u for update;
  if exists(select 1 from public.household_members where user_id = u) then
    raise exception 'Você já participa de um espaço';
  end if;

  insert into public.households(name, created_by)
  values (trim(p_name), u)
  returning id into h;
  insert into public.household_members values (h, u, 'a');
  insert into public.finance_state(household_id, document)
  values (h, p_document);
  update public.household_registry set household_id = h where singleton = true;

  return h;
end $$;

revoke execute on function public.create_household(text, jsonb) from public, anon;
grant execute on function public.create_household(text, jsonb) to authenticated;

commit;