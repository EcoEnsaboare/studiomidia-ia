alter table public.sm_ai_jobs add column caption text check (length(caption)<=2200);
