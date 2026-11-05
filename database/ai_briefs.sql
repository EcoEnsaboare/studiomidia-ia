begin;
alter table public.sm_ai_jobs add column kind text not null default 'image' check(kind in ('image','brief'));
create function sm_private.sm_ai_reserve_brief(p_workspace uuid,p_user uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare job_id uuid;
begin
 if not exists(select 1 from public.sm_members where workspace_id=p_workspace and user_id=p_user and role in ('owner','editor')) then raise exception 'AI_ACCESS_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,1));
 if not exists(select 1 from public.sm_ai_access where workspace_id=p_workspace and enabled) then raise exception 'AI_NOT_ENABLED'; end if;
 if exists(select 1 from public.sm_ai_jobs where workspace_id=p_workspace and request_id=p_request) then raise exception 'AI_DUPLICATE_REQUEST'; end if;
 if exists(select 1 from public.sm_ai_jobs where workspace_id=p_workspace and kind='brief' and created_at>=((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo')) then raise exception 'BRIEF_DAILY_LIMIT'; end if;
 insert into public.sm_ai_jobs(workspace_id,user_id,request_id,kind) values(p_workspace,p_user,p_request,'brief') returning id into job_id;
 return job_id;
end $$;
revoke all on function sm_private.sm_ai_reserve_brief(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function sm_private.sm_ai_reserve_brief(uuid,uuid,uuid) to service_role;
create function public.sm_ai_reserve_brief(p_workspace uuid,p_user uuid,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$ select sm_private.sm_ai_reserve_brief(p_workspace,p_user,p_request) $$;
revoke all on function public.sm_ai_reserve_brief(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.sm_ai_reserve_brief(uuid,uuid,uuid) to service_role;
create or replace function sm_private.sm_ai_reserve(p_workspace uuid,p_user uuid,p_request uuid) returns uuid
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
 if exists(select 1 from public.sm_ai_jobs where workspace_id=p_workspace and kind='image' and status='reserved' and created_at>now()-interval '5 minutes') then
  raise exception 'AI_BUSY';
 end if;
 -- Includes failures/unknown outcomes: ambiguous requests must never be retried automatically.
 if (select count(*) from public.sm_ai_jobs where workspace_id=p_workspace and kind='image' and created_at>=((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo'))>=quota then
  raise exception 'AI_DAILY_LIMIT';
 end if;
 insert into public.sm_ai_jobs(workspace_id,user_id,request_id) values(p_workspace,p_user,p_request) returning id into job_id;
 return job_id;
end $$;
commit;
