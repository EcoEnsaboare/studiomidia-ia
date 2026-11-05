import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSocial,jpegDimensions} from '../supabase/functions/generate-image/social.mjs';
const W='00000000-0000-0000-0000-000000000001';
function harness({key='test-windsor-key',selected=true,duplicate=false,timeout=false}={}){
 const calls=[];const account={account_id:'instagram-account',username:'ecoensaboare',enabled:true};
 const item={id:'i',selected,imagePath:W+'/generated/i.png',caption:'Legenda aprovada',format:'1080x1350'};
 const userClient={from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='sm_social_accounts'?account:{value:[{id:'c',type:'Campanha IA',items:[item]}]}};}};}};
 const admin={rpc:async()=>duplicate?{error:{message:'SOCIAL_ALREADY_SUBMITTED'}}:{data:'job'},from(){return {update(data){calls.push({update:data});return {eq:async()=>({})};}};},storage:{from(){return {upload:async()=>({}),createSignedUrl:async()=>({data:{signedUrl:'https://signed.example/post.jpg'}})};}}};
 const fetcher=async(url,options={})=>{calls.push({url:String(url),options});if(options.method==='POST'){if(timeout)throw Error('timeout');return new Response(JSON.stringify({result:{id:'media-id'}}));}return new Response(JSON.stringify([{id:'create_image_post'}]));};
 const form=new FormData();form.set('action','publish-instagram');form.set('publishConsent','true');form.set('sourceId','c-i');form.set('finalImage',new Blob([new Uint8Array([255,216,255,192,0,11,8,5,70,4,56,1,1,17,0,255,217])],{type:'image/jpeg'}),'post.jpg');
 return {calls,form,run:()=>handleSocial({workspace:W,user:{id:'user'},userClient,admin,form,env:()=>key,fetcher})};
}
test('publishing requires server key, selected image and explicit consent',async()=>{
 for(const setup of [{key:''},{selected:false},{}]){const h=harness(setup);if(!Object.keys(setup).length)h.form.set('publishConsent','false');const r=await h.run();assert.ok(r.status>=400);assert.equal(h.calls.filter(c=>c.options?.method==='POST').length,0);}
});
test('publishing uses the server account and saved caption and blocks duplicates',async()=>{
 const h=harness();const r=await h.run();assert.equal(r.data.status,'submitted');const payload=JSON.parse(h.calls.find(c=>c.options?.method==='POST').options.body);assert.equal(payload.account,'instagram-account');assert.equal(payload.params.caption,'Legenda aprovada');assert.ok(payload.params.image_url.startsWith('https://signed.example/'));
 const duplicate=harness({duplicate:true});assert.equal((await duplicate.run()).data.error,'SOCIAL_ALREADY_SUBMITTED');assert.equal(duplicate.calls.filter(c=>c.options?.method==='POST').length,0);
});
test('ambiguous publishing outcomes are recorded and never retried automatically',async()=>{const h=harness({timeout:true});assert.equal((await h.run()).data.error,'SOCIAL_RESULT_UNKNOWN');assert.ok(h.calls.some(c=>c.update?.status==='unknown'));assert.equal(h.calls.filter(c=>c.options?.method==='POST').length,1);});
test('JPEG dimensions reject disguised uploads',()=>{assert.equal(jpegDimensions(new TextEncoder().encode('<svg/>')),null);});
