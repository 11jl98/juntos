-- Execute once in the Supabase SQL Editor. Never put the service key in NEXT_PUBLIC variables.
begin;
create table public.households(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.household_members(household_id uuid not null references public.households(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,slot text not null check(slot in ('a','b')),primary key(household_id,user_id),unique(user_id),unique(household_id,slot));
create table public.finance_state(household_id uuid primary key references public.households(id) on delete cascade,document jsonb not null check(jsonb_typeof(document)='object' and document->>'schemaVersion'='1'),revision integer not null default 0,updated_at timestamptz not null default now());
create table public.invitations(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id) on delete cascade,email text not null,token_hash text not null unique,expires_at timestamptz not null default now()+interval '7 days',used_at timestamptz);
create table public.finance_requests(household_id uuid not null references public.households(id) on delete cascade,request_id uuid not null,actor uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(household_id,request_id));
create table public.audit_events(id bigint generated always as identity primary key,household_id uuid not null references public.households(id) on delete cascade,actor uuid not null references auth.users(id),action text not null,revision integer not null,created_at timestamptz not null default now());
create index household_members_lookup on public.household_members(user_id,household_id);

create function public.is_household_member(h uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.household_members m where m.household_id=h and m.user_id=auth.uid()) $$;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.finance_state enable row level security;
alter table public.invitations enable row level security;
alter table public.finance_requests enable row level security;
alter table public.audit_events enable row level security;
create policy household_read on public.households for select to authenticated using(public.is_household_member(id));
create policy members_read on public.household_members for select to authenticated using(public.is_household_member(household_id));
create policy finance_read on public.finance_state for select to authenticated using(public.is_household_member(household_id));
create policy audit_read on public.audit_events for select to authenticated using(public.is_household_member(household_id));
revoke all on public.households,public.household_members,public.finance_state,public.invitations,public.finance_requests,public.audit_events from anon,authenticated;
grant select on public.households,public.household_members,public.finance_state,public.audit_events to authenticated;
grant all on public.households,public.household_members,public.finance_state,public.invitations,public.finance_requests,public.audit_events to service_role;
grant usage,select on sequence public.audit_events_id_seq to service_role;

create function public.create_household(p_name text,p_document jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Login necessário';end if;
 perform 1 from auth.users where id=u for update;
 if exists(select 1 from public.household_members where user_id=u) then raise exception 'Você já participa de um espaço';end if;
 insert into public.households(name,created_by) values(trim(p_name),u) returning id into h;
 insert into public.household_members values(h,u,'a');
 insert into public.finance_state(household_id,document) values(h,p_document);
 return h;
end $$;

create function public.issue_invite(p_household uuid,p_email text) returns text language plpgsql security definer set search_path='' as $$
declare token text:=gen_random_uuid()::text||gen_random_uuid()::text;
begin
 perform 1 from public.households where id=p_household and created_by=auth.uid() for update;
 if not found then raise exception 'Somente o criador pode convidar';end if;
 if (select count(*) from public.household_members where household_id=p_household)>=2 then raise exception 'O espaço já tem dois membros';end if;
 if length(p_email)>254 or position('@' in p_email)<2 then raise exception 'E-mail inválido';end if;
 update public.invitations set used_at=now() where household_id=p_household and used_at is null;
 insert into public.invitations(household_id,email,token_hash) values(p_household,lower(trim(p_email)),encode(sha256(convert_to(token,'UTF8')),'hex'));
 return token;
end $$;

create function public.join_household(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Login necessário';end if;
 perform 1 from auth.users where id=u for update;
 select * into i from public.invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then raise exception 'Convite inválido';end if;
 perform 1 from public.households where id=i.household_id for update;
 select * into i from public.invitations where id=i.id for update;
 if i.used_at is not null or i.expires_at<now() or i.email<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Convite inválido, expirado ou para outro e-mail';end if;
 if exists(select 1 from public.household_members where user_id=u) then raise exception 'Você já participa de um espaço';end if;
 if (select count(*) from public.household_members where household_id=i.household_id)>=2 then raise exception 'O espaço já tem dois membros';end if;
 insert into public.household_members values(i.household_id,u,'b');
 update public.invitations set used_at=now() where id=i.id;
 return i.household_id;
end $$;

-- Service-only mutation. Next.js verifies getUser and the command schema first.
create function public.save_finance(p_household uuid,p_actor uuid,p_revision integer,p_request uuid,p_document jsonb,p_action text) returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 if not exists(select 1 from public.household_members where household_id=p_household and user_id=p_actor) then raise exception 'Acesso negado';end if;
 select revision into current_revision from public.finance_state where household_id=p_household for update;
 if exists(select 1 from public.finance_requests where household_id=p_household and request_id=p_request and actor=p_actor) then return current_revision;end if;
 if current_revision<>p_revision then raise exception 'CONFLICT: dados atualizados pelo outro membro';end if;
 update public.finance_state set document=p_document,revision=revision+1,updated_at=now() where household_id=p_household;
 insert into public.finance_requests(household_id,request_id,actor) values(p_household,p_request,p_actor);
 insert into public.audit_events(household_id,actor,action,revision) values(p_household,p_actor,left(p_action,100),current_revision+1);
 return current_revision+1;
end $$;

revoke execute on function public.is_household_member(uuid),public.create_household(text,jsonb),public.issue_invite(uuid,text),public.join_household(text),public.save_finance(uuid,uuid,integer,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.is_household_member(uuid),public.create_household(text,jsonb),public.issue_invite(uuid,text),public.join_household(text) to authenticated;
grant execute on function public.save_finance(uuid,uuid,integer,uuid,jsonb,text) to service_role;
commit;
