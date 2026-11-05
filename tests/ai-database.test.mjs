import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
test('AI database prevents self-activation, duplicates, cross-tenant calls and excess quota',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  await db.exec(readFileSync(new URL('../database/workspaces.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../database/ai_generation.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../database/ai_briefs.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../database/ai_captions.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
  const workspace=(await db.query("select public.sm_ensure_workspace('A') as id")).rows[0].id;
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,A,crypto.randomUUID()]),/permission denied/);
  await assert.rejects(()=>db.query('insert into public.sm_ai_access values($1,true,30)',[workspace]),/permission denied/);
  await db.exec('reset role;');
  await db.query('insert into public.sm_ai_access values($1,false,1)',[workspace]);
  await db.exec('set role service_role;');
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,A,crypto.randomUUID()]),/AI_NOT_ENABLED/);
  await db.exec('reset role;');await db.query('update public.sm_ai_access set enabled=true where workspace_id=$1',[workspace]);await db.exec('set role service_role;');
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,B,crypto.randomUUID()]),/AI_ACCESS_DENIED/);
  await db.query('select public.sm_ai_reserve_brief($1,$2,$3)',[workspace,A,crypto.randomUUID()]);
  await assert.rejects(()=>db.query('select public.sm_ai_reserve_brief($1,$2,$3)',[workspace,A,crypto.randomUUID()]),/BRIEF_DAILY_LIMIT/);
  const request=crypto.randomUUID(),job=(await db.query('select public.sm_ai_reserve($1,$2,$3) as id',[workspace,A,request])).rows[0].id;
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,A,request]),/AI_DUPLICATE_REQUEST/);
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,A,crypto.randomUUID()]),/AI_BUSY/);
  await db.query("update public.sm_ai_jobs set status='failed' where id=$1",[job]);
  await assert.rejects(()=>db.query('select public.sm_ai_reserve($1,$2,$3)',[workspace,A,crypto.randomUUID()]),/AI_DAILY_LIMIT/);
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${B}';`);
  assert.equal((await db.query('select * from public.sm_ai_jobs')).rows.length,0);
 }finally{await db.close();}
});
