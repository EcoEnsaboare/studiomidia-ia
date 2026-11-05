begin;
create table public.sm_social_accounts(workspace_id uuid primary key references public.sm_workspaces on delete cascade,account_id text not null,username text not null,enabled boolean not null default false);
create table public.sm_social_jobs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.sm_workspaces on delete cascade,user_id uuid not null references auth.users,source_id text not null,status text not null default 'reserved' check(status in ('reserved','submitted','failed','unknown')),created_at timestamptz not null default now(),unique(workspace_id,source_id));
create index sm_social_jobs_user_idx on public.sm_social_jobs(user_id);
alter table public.sm_social_accounts enable row level security;
alter table public.sm_social_jobs enable row level security;
revoke all on public.sm_social_accounts,public.sm_social_jobs from anon,authenticated;
grant select on public.sm_social_accounts,public.sm_social_jobs to authenticated;
grant all on public.sm_social_accounts,public.sm_social_jobs to service_role;
create policy social_accounts_member on public.sm_social_accounts for select to authenticated using(exists(select 1 from public.sm_members m where m.workspace_id=sm_social_accounts.workspace_id and m.user_id=(select auth.uid())));
create policy social_jobs_member on public.sm_social_jobs for select to authenticated using(exists(select 1 from public.sm_members m where m.workspace_id=sm_social_jobs.workspace_id and m.user_id=(select auth.uid())));
create function sm_private.sm_social_reserve(p_workspace uuid,p_user uuid,p_source text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.sm_members where workspace_id=p_workspace and user_id=p_user and role in ('owner','editor')) then raise exception 'ACCESS_DENIED'; end if;
 if length(p_source)>150 then raise exception 'INVALID_SOURCE';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,5));
 if not exists(select 1 from public.sm_social_accounts where workspace_id=p_workspace and enabled) then raise exception 'SOCIAL_NOT_CONFIGURED';end if;
 if exists(select 1 from public.sm_social_jobs where workspace_id=p_workspace and source_id=p_source) then raise exception 'SOCIAL_ALREADY_SUBMITTED';end if;
 insert into public.sm_social_jobs(workspace_id,user_id,source_id) values(p_workspace,p_user,p_source) returning id into result;
 return result;
end $$;
revoke all on function sm_private.sm_social_reserve(uuid,uuid,text) from public,anon,authenticated;
grant execute on function sm_private.sm_social_reserve(uuid,uuid,text) to service_role;
create function public.sm_social_reserve(p_workspace uuid,p_user uuid,p_source text) returns uuid language sql security invoker set search_path='' as $$ select sm_private.sm_social_reserve(p_workspace,p_user,p_source) $$;
revoke all on function public.sm_social_reserve(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sm_social_reserve(uuid,uuid,text) to service_role;
commit;
