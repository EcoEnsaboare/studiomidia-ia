import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../database/workspaces.sql',import.meta.url),'utf8');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
test('Postgres: tenant isolation, anonymous access, roles and revision conflicts',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   insert into auth.users values('${A}'),('${B}');
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(sql);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}';`);
  const widA=(await db.query("select public.sm_ensure_workspace('Empresa A') as id")).rows[0].id;
  assert.equal((await db.query("select public.sm_ensure_workspace('Outra') as id")).rows[0].id,widA);
  assert.equal((await db.query('select public.sm_save_state($1,$2,$3::jsonb,0) as revision',[widA,'sm_posts','[]'])).rows[0].revision,1);
  await assert.rejects(()=>db.query('select public.sm_save_state($1,$2,$3::jsonb,0)',[widA,'sm_posts','[]']),/STATE_CONFLICT/);
  await db.exec(`set request.jwt.claim.sub='${B}';`);
  const widB=(await db.query("select public.sm_ensure_workspace('Empresa B') as id")).rows[0].id;
  assert.notEqual(widA,widB);
  assert.equal((await db.query('select * from public.sm_state where workspace_id=$1',[widA])).rows.length,0);
  assert.equal((await db.query('select * from public.sm_workspaces where id=$1',[widA])).rows.length,0);
  await assert.rejects(()=>db.query('select public.sm_save_state($1,$2,$3::jsonb,1)',[widA,'sm_posts','[]']),/Access denied/);
  await assert.rejects(()=>db.query("insert into public.sm_members values($1,$2,'owner')",[widA,B]),/permission denied/);
  await db.exec('reset role;');
  await db.query("update public.sm_members set role='viewer' where workspace_id=$1",[widB]);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${B}';`);
  await assert.rejects(()=>db.query('select public.sm_save_state($1,$2,$3::jsonb,0)',[widB,'sm_posts','[]']),/Access denied/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(()=>db.query('select * from public.sm_state'),/permission denied/);
  await assert.rejects(()=>db.query("select public.sm_ensure_workspace('Anon')"),/permission denied/);
  await db.exec('reset role; set role authenticated; set request.jwt.claim.sub=\'\';');
  await assert.rejects(()=>db.query("select public.sm_ensure_workspace('No session')"),/Authentication required/);
 } finally {await db.close();}
});
