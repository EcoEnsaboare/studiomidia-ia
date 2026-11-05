import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../cloud.js',import.meta.url),'utf8').replace("await import('@supabase/supabase-js')",'globalThis.testSdk');
async function harness() {
  const elements=new Map(), listeners={};
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,disabled:false,textContent:'',reportValidity:()=>true});return elements.get(id);};
  let cb, conflict=false, calls=[];
  const session={user:{id:'user-a',email:'user@example.test',user_metadata:{company_name:'Empresa A'}}};
  const client={
    auth:{onAuthStateChange:fn=>{cb=fn;},getSession:async()=>({data:{session}}),signOut:async()=>({error:null})},
    rpc:async(name,args)=>{
      calls.push({name,args});
      if(name==='sm_ensure_workspace')return {data:'workspace-a'};
      if(conflict)return {error:{code:'40001'}};
      return {data:args.p_revision+1};
    },
    from:()=>({select:()=>({eq:async()=>({data:[]})})})
  };
  const sandbox={console,structuredClone,URLSearchParams,setTimeout,Event,alert:()=>{},confirm:()=>true,
    location:{hash:'',origin:'https://example.test',reload:()=>{}},
    localStorage:{getItem:()=>null},testSdk:{createClient:()=>client},
    document:{getElementById:element,querySelector:()=>element('layout'),createElement:()=>({}),body:{append:script=>script.onload()}},
    addEventListener:(n,f)=>{listeners[n]=f;},dispatchEvent:e=>listeners[e.type]?.(e),
    STUDIO_CONFIG:{supabaseUrl:'https://example.supabase.co',supabaseKey:'sb_publishable_test'}
  };
  sandbox.window=sandbox;
  await vm.runInNewContext('(async()=>{'+source+'})()',sandbox);
  return {cloud:sandbox.StudioCloud,element,calls,fail:()=>{conflict=true;},event:(...args)=>cb(...args),sandbox};
}
test('cloud data loads only for a verified session; separate snapshots avoid accidental writes',async()=>{
  const h=await harness();assert.equal(h.element('auth-gate').hidden,true);
  assert.equal(h.cloud.companyName,'Empresa A');
  const data=h.cloud.read('sm_posts',[]);data.push({title:'Unsaved'});
  assert.equal(h.cloud.read('sm_posts',[]).length,0);
});
test('serialized writes use the latest revision and report confirmed saves',async()=>{
  const h=await harness();const results=await Promise.all([h.cloud.write('sm_posts',[{title:'first'}]),h.cloud.write('sm_posts',[{title:'second'}])]);
  assert.deepEqual(results,[true,true]);
  const writes=h.calls.filter(c=>c.name==='sm_save_state');
  assert.deepEqual(writes.map(c=>c.args.p_revision),[0,1]);
  assert.equal(h.cloud.read('sm_posts',[])[0].title,'second');
  assert.equal(h.element('cloud-status').textContent,'Salvo na nuvem');
});
test('conflicts do not update confirmed data and block subsequent overwrites',async()=>{
  const h=await harness();await h.cloud.write('sm_posts',[{title:'confirmed'}]);h.fail();
  assert.equal(await h.cloud.write('sm_posts',[{title:'conflict'}]),false);
  const count=h.calls.length;
  assert.equal(await h.cloud.write('sm_posts',[{title:'overwrite'}]),false);
  assert.equal(h.calls.length,count);
  assert.equal(h.cloud.read('sm_posts',[])[0].title,'confirmed');
});
test('missing configuration fails closed without loading the app',async()=>{
  const h=await harness();const clean=source.replace('const config=window.STUDIO_CONFIG;','const config=undefined;');
  h.sandbox.StudioCloud=undefined;
  await vm.runInNewContext('(async()=>{'+clean+'})()',h.sandbox);
  assert.equal(h.element('layout').hidden,true);
  assert.equal(h.element('auth-submit').disabled,true);
  assert.equal(h.sandbox.StudioCloud,undefined);
});
