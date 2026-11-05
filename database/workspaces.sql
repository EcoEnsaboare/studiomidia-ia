begin;
create schema if not exists sm_private;
revoke all on schema sm_private from public,anon;
grant usage on schema sm_private to authenticated;
create table public.sm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.sm_members (
  workspace_id uuid not null references public.sm_workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (workspace_id,user_id)
);
create index sm_members_user on public.sm_members(user_id);
create table public.sm_state (
  workspace_id uuid not null references public.sm_workspaces on delete cascade,
  key text not null check (key in ('sm_brand','sm_posts','sm_projects')),
  value jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id,key)
);
alter table public.sm_workspaces enable row level security;
alter table public.sm_members enable row level security;
alter table public.sm_state enable row level security;
revoke all on public.sm_workspaces,public.sm_members,public.sm_state from anon,authenticated;
grant select on public.sm_workspaces,public.sm_members,public.sm_state to authenticated;
create policy members_read_self on public.sm_members for select to authenticated using (user_id=(select auth.uid()));
create policy workspaces_read_member on public.sm_workspaces for select to authenticated using (
  exists(select 1 from public.sm_members m where m.workspace_id=id and m.user_id=(select auth.uid()))
);
create policy state_read_member on public.sm_state for select to authenticated using (
  exists(select 1 from public.sm_members m where m.workspace_id=sm_state.workspace_id and m.user_id=(select auth.uid()))
);
-- Identity comes from the verified JWT, never from a client-supplied user ID.
create function sm_private.sm_ensure_workspace(company_name text default 'Minha empresa') returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wid uuid;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select m.workspace_id into wid from public.sm_members m where m.user_id=uid order by m.workspace_id limit 1;
  if wid is null then
    insert into public.sm_workspaces(name) values(left(coalesce(nullif(trim(company_name),''),'Minha empresa'),120)) returning id into wid;
    insert into public.sm_members(workspace_id,user_id,role) values(wid,uid,'owner');
  end if;
  return wid;
end $$;
create function sm_private.sm_save_state(p_workspace uuid,p_key text,p_value jsonb,p_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare next_revision bigint;
begin
  if auth.uid() is null or not exists(select 1 from public.sm_members where workspace_id=p_workspace and user_id=auth.uid() and role in ('owner','editor')) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if p_key not in ('sm_brand','sm_posts','sm_projects') or p_key is null or p_value is null or p_revision is null or p_revision<0 then
    raise exception 'Invalid state';
  end if;
  if octet_length(p_value::text)>3000000 or (p_key='sm_brand' and jsonb_typeof(p_value)<>'object') or (p_key<>'sm_brand' and jsonb_typeof(p_value)<>'array') then
    raise exception 'Invalid payload';
  end if;
  if p_revision=0 then
    insert into public.sm_state(workspace_id,key,value) values(p_workspace,p_key,p_value)
    on conflict do nothing returning revision into next_revision;
  else
    update public.sm_state set value=p_value,revision=revision+1,updated_at=now()
    where workspace_id=p_workspace and key=p_key and revision=p_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'STATE_CONFLICT' using errcode='40001'; end if;
  return next_revision;
end $$;
revoke all on function sm_private.sm_ensure_workspace(text) from public,anon;
revoke all on function sm_private.sm_save_state(uuid,text,jsonb,bigint) from public,anon;
grant execute on function sm_private.sm_ensure_workspace(text) to authenticated;
grant execute on function sm_private.sm_save_state(uuid,text,jsonb,bigint) to authenticated;
-- Public invoker wrappers expose only these two deliberately authorized actions.
create function public.sm_ensure_workspace(company_name text default 'Minha empresa') returns uuid
language sql security invoker set search_path='' as $$ select sm_private.sm_ensure_workspace(company_name) $$;
create function public.sm_save_state(p_workspace uuid,p_key text,p_value jsonb,p_revision bigint) returns bigint
language sql security invoker set search_path='' as $$ select sm_private.sm_save_state(p_workspace,p_key,p_value,p_revision) $$;
revoke all on function public.sm_ensure_workspace(text) from public,anon;
revoke all on function public.sm_save_state(uuid,text,jsonb,bigint) from public,anon;
grant execute on function public.sm_ensure_workspace(text) to authenticated;
grant execute on function public.sm_save_state(uuid,text,jsonb,bigint) to authenticated;
commit;
