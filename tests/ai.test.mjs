import test from 'node:test';
import assert from 'node:assert/strict';
import {planCampaign} from '../ai-plan.mjs';
import {createHandler,allowedOrigin,imageType,makePrompt} from '../supabase/functions/generate-image/core.mjs';
const W='00000000-0000-0000-0000-000000000001',U='00000000-0000-0000-0000-000000000002',R='00000000-0000-0000-0000-000000000003';
const png=new Uint8Array([137,80,78,71,13,10,26,10,1]);
function harness({ready=true,role='owner',reservationError=null}={}){
 const calls={provider:[],uploads:[],updates:[]};
 const user={
  auth:{getUser:async()=>({data:{user:{id:U}}})},
  from(table){return {
   select(){return this;},eq(){return this;},
   async maybeSingle(){return {data:table==='sm_members'?(role?{role}:null):{enabled:true,daily_limit:5}};}
  };}
 };
 const admin={
  rpc:async()=>reservationError?{error:{message:reservationError}}:{data:R},
  from:()=>({update:data=>{calls.updates.push(data);return {eq:async()=>({error:null})};}}),
  storage:{from:()=>({
   download:async()=>({data:new Blob([png],{type:'image/png'})}),
   upload:async(path)=>{calls.uploads.push(path);return {};},
   createSignedUrl:async()=>({data:{signedUrl:'https://signed.example.test/image'}})
  })}
 };
 const env=key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',OPENAI_API_KEY:ready?'TEST_KEY':undefined,STUDIO_AI_ENABLED:'true'}[key]);
 const handler=createHandler({createClient:(_,key)=>key==='service'?admin:user,env,fetcher:async(url,options)=>{calls.provider.push({url,...options});return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Campanha inspirada nos ambientes, cores e serviços visíveis na imagem.'}]}],data:[{b64_json:Buffer.from(png).toString('base64')}]}),{status:200});}});
 return {handler,calls};
}
function req(extra={}){const f=new FormData();for(const [k,v] of Object.entries({action:'generate',workspace:W,requestId:R,prompt:'A new clean living room scene',size:'1024x1024',consent:'true',...extra}))f.set(k,v);return new Request('https://function.example.test',{method:'POST',headers:{Authorization:'Bearer test-token',Origin:'https://ecoensaboare.netlify.app'},body:f});}
test('monthly planner spreads dates across a valid month and creates distinct briefs',()=>{
 const items=planCampaign({month:'2028-02',count:12,services:['Sofás','Tapetes'],brief:'Ambientes novos e claros',mode:'idea'});
 assert.equal(items.length,12);assert.equal(new Set(items.map(i=>i.id)).size,12);assert.equal(new Set(items.map(i=>i.prompt)).size,12);assert.ok(items.every(i=>Number(i.date.slice(-2))<=29));
 assert.throws(()=>planCampaign({month:'2026-13',count:12,services:['Sofás'],brief:'Ambientes novos',mode:'idea'}));
});
test('API rejects missing sessions and foreign origins without charging',async()=>{
 const h=harness();assert.equal((await h.handler(new Request('https://function.example.test'))).status,401);
 const r=req();const bad=new Request(r,{headers:{Authorization:'Bearer test-token',Origin:'https://evil.example'}});assert.equal((await h.handler(bad)).status,403);assert.equal(h.calls.provider.length,0);
});
test('AI unavailable cannot call provider even with valid account',async()=>{const h=harness({ready:false});const result=await h.handler(req());assert.equal(result.status,503);assert.equal((await result.json()).error,'AI_NOT_CONFIGURED');assert.equal(h.calls.provider.length,0);});
test('viewer cannot request images or references',async()=>{const h=harness({role:'viewer'});assert.equal((await h.handler(req())).status,403);assert.equal(h.calls.provider.length,0);});
test('quota and duplicate reservations stop provider calls',async()=>{for(const code of ['AI_DAILY_LIMIT','AI_DUPLICATE_REQUEST','AI_BUSY']){const h=harness({reservationError:code});assert.equal((await h.handler(req())).status,409);assert.equal(h.calls.provider.length,0);}});
test('reference path cannot read another company',async()=>{const h=harness();assert.equal((await h.handler(req({referencePath:U+'/references/model.png'}))).status,400);assert.equal(h.calls.provider.length,0);});
test('idea generation sends one new-image request and saves in workspace folder',async()=>{const h=harness();const r=await h.handler(req());assert.equal(r.status,200);assert.equal(h.calls.provider.length,1);assert.ok(h.calls.provider[0].url.endsWith('/generations'));const body=JSON.parse(h.calls.provider[0].body);assert.equal(body.n,1);assert.equal(body.quality,'medium');assert.ok(body.prompt.includes('original scene'));assert.ok(h.calls.uploads[0].startsWith(W+'/generated/'));assert.ok(h.calls.updates.some(u=>u.status==='succeeded'));});
test('reference generation uses edits endpoint with image file and new-scene instructions',async()=>{const h=harness();assert.equal((await h.handler(req({referencePath:W+'/references/model.png'}))).status,200);assert.ok(h.calls.provider[0].url.endsWith('/edits'));const f=h.calls.provider[0].body;assert.ok(f.get('image') instanceof Blob);assert.ok(f.get('prompt').includes('visibly DIFFERENT scene'));});
test('provider is never called without explicit paid-use consent',async()=>{const h=harness();assert.equal((await h.handler(req({consent:'false'}))).status,400);assert.equal(h.calls.provider.length,0);});
test('reference signatures reject disguised uploads and origin list stays scoped',()=>{assert.equal(imageType(new TextEncoder().encode('<svg>bad</svg>')),null);assert.equal(imageType(png),'image/png');assert.equal(allowedOrigin('https://deploy-preview-12--ecoensaboare.netlify.app'),true);assert.equal(allowedOrigin('https://other.netlify.app'),false);assert.ok(makePrompt('brief',true).includes('Do not reuse the reference as a background'));});

test('description uses image understanding separately and requires consent, membership and a valid reference',async()=>{
 const h=harness();const result=await h.handler(req({action:'describe-reference',referencePath:W+'/references/model.png'}));
 assert.equal(result.status,200);assert.ok((await result.json()).description.includes('Campanha'));
 const call=h.calls.provider[0],body=JSON.parse(call.body);assert.ok(call.url.endsWith('/responses'));assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.max_output_tokens,450);assert.ok(body.input[0].content[1].image_url.startsWith('data:image/png;base64,'));assert.equal(h.calls.uploads.length,0);
 for(const extra of [{consent:'false'},{referencePath:U+'/references/x.png'},{referencePath:''}]){const h=harness();assert.equal((await h.handler(req({action:'describe-reference',referencePath:W+'/references/model.png',...extra}))).status,400);assert.equal(h.calls.provider.length,0);}
 const denied=harness({role:'viewer'});assert.equal((await denied.handler(req({action:'describe-reference'}))).status,403);
});

test('status identifies missing configuration without returning credentials',async()=>{
 const h=harness({ready:false});const request=new Request('https://function.example.test?workspace='+W,{headers:{Authorization:'Bearer test-token'}});
 const result=await h.handler(request),data=await result.json();assert.deepEqual(data.missingConfiguration,['OPENAI_API_KEY']);assert.equal(data.enabled,false);assert.ok(!JSON.stringify(data).includes('TEST_KEY'));assert.equal(h.calls.provider.length,0);
});

test('image generation optionally analyzes the new image for a separate caption after saving the image',async()=>{
 const h=harness();const r=await h.handler(req({withCaption:'true'}));assert.equal(r.status,200);const data=await r.json();assert.ok(data.path);assert.ok(data.caption);assert.equal(h.calls.provider.length,2);const captionCall=h.calls.provider[1];assert.ok(captionCall.url.endsWith('/responses'));const payload=JSON.parse(captionCall.body);assert.equal(payload.store,false);assert.ok(payload.input[0].content[1].image_url.startsWith('data:image/png;base64,'));assert.ok(h.calls.updates.some(u=>u.caption));
});
