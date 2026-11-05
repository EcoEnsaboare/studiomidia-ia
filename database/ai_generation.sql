begin;
create table public.sm_ai_access (
 workspace_id uuid primary key references public.sm_workspaces on delete cascade,
 enabled boolean not null default false,
 daily_limit integer not null default 5 check(daily_limit between 1 and 30)
);
create table public.sm_ai_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.sm_workspaces on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 request_id uuid not null,
 status text not null default 'reserved' check(status in ('reserved','succeeded','failed','unknown')),
 image_path text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,request_id)
);
create index sm_ai_jobs_workspace_created on public.sm_ai_jobs(workspace_id,created_at desc);
create index sm_ai_jobs_user on public.sm_ai_jobs(user_id);
alter table public.sm_ai_access enable row level security;
alter table public.sm_ai_jobs enable row level security;
revoke all on public.sm_ai_access,public.sm_ai_jobs from anon,authenticated;
grant select on public.sm_ai_access,public.sm_ai_jobs to authenticated;
grant all on public.sm_ai_access,public.sm_ai_jobs to service_role;
create policy ai_access_read on public.sm_ai_access for select to authenticated using (
 exists(select 1 from public.sm_members m where m.workspace_id=sm_ai_access.workspace_id and m.user_id=(select auth.uid()))
);
create policy ai_jobs_read on public.sm_ai_jobs for select to authenticated using (
 exists(select 1 from public.sm_members m where m.workspace_id=sm_ai_jobs.workspace_id and m.user_id=(select auth.uid()))
);
-- No account can enable paid generation or grant itself extra quota.
insert into public.sm_ai_access(workspace_id) select id from public.sm_workspaces on conflict do nothing;
create function sm_private.sm_ai_reserve(p_workspace uuid,p_user uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare job_id uuid; quota integer;
begin
 if not exists(select 1 from public.sm_members where workspace_id=p_workspace and user_id=p_user and role in ('owner','editor')) then
  raise exception 'AI_ACCESS_DENIED' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,1));
 if exists(select 1 from public.sm_ai_jobs where workspace_id=p_workspace and request_id=p_request) then
  raise exception 'AI_DUPLICATE_REQUEST';
 end if;
 select daily_limit into quota from public.sm_ai_access where workspace_id=p_workspace and enabled=true;
 if quota is null then raise exception 'AI_NOT_ENABLED'; end if;
 if exists(select 1 from public.sm_ai_jobs where workspace_id=p_workspace and status='reserved' and created_at>now()-interval '5 minutes') then
  raise exception 'AI_BUSY';
 end if;
 -- Includes failures/unknown outcomes: ambiguous requests must never be retried automatically.
 if (select count(*) from public.sm_ai_jobs where workspace_id=p_workspace and created_at>=((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo'))>=quota then
  raise exception 'AI_DAILY_LIMIT';
 end if;
 insert into public.sm_ai_jobs(workspace_id,user_id,request_id) values(p_workspace,p_user,p_request) returning id into job_id;
 return job_id;
end $$;
revoke all on function sm_private.sm_ai_reserve(uuid,uuid,uuid) from public,anon,authenticated;
grant usage on schema sm_private to service_role;
grant execute on function sm_private.sm_ai_reserve(uuid,uuid,uuid) to service_role;
create function public.sm_ai_reserve(p_workspace uuid,p_user uuid,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$ select sm_private.sm_ai_reserve(p_workspace,p_user,p_request) $$;
revoke all on function public.sm_ai_reserve(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.sm_ai_reserve(uuid,uuid,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sm-ai-images','sm-ai-images',false,20000000,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
create policy ai_images_member_read on storage.objects for select to authenticated using (
 bucket_id='sm-ai-images' and exists(select 1 from public.sm_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
);
commit;
