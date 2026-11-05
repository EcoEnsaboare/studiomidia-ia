// Only the server's configured workspace account may receive a post.
export function jpegDimensions(bytes){
 if(bytes[0]!==255||bytes[1]!==216)return null;let p=2;
 while(p+8<bytes.length){if(bytes[p++]!==255)continue;let marker=bytes[p++];while(marker===255)marker=bytes[p++];if(marker===217||marker===218)return null;if(marker===1||(marker>=208&&marker<=215))continue;const len=bytes[p]*256+bytes[p+1];if(len<2||p+len>bytes.length)return null;if([192,193,194].includes(marker))return {width:bytes[p+5]*256+bytes[p+6],height:bytes[p+3]*256+bytes[p+4]};p+=len;}return null;
}
export async function handleSocial({workspace,user,userClient,admin,form,env,fetcher}){
 const action=form.get('action'),key=env('WINDSOR_API_KEY')?.trim();
 const account=await userClient.from('sm_social_accounts').select('account_id,username,enabled').eq('workspace_id',workspace).maybeSingle();
 if(account.error)return {status:503,data:{error:'SOCIAL_DATABASE_UNAVAILABLE'}};
 const ready=Boolean(key&&account.data?.enabled);
 if(action==='social-status'){
  let accessVerified=false;
  if(ready)try{const url=new URL('https://connectors.windsor.ai/instagram/actions');url.searchParams.set('api_key',key);const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(r.ok){const actions=await r.json();accessVerified=Array.isArray(actions)&&actions.some(a=>a.id==='create_image_post');}}catch{}
  return {status:200,data:{configured:ready&&accessVerified,accessVerified,username:account.data?.username||null,missingKey:!key,accessError:ready&&!accessVerified}};
 }
 if(!ready)return {status:503,data:{error:'SOCIAL_NOT_CONFIGURED'}};
 if(form.get('publishConsent')!=='true')return {status:400,data:{error:'SOCIAL_CONSENT_REQUIRED'}};
 const source=form.get('sourceId'),file=form.get('finalImage');
 if(typeof source!=='string'||source.length>150||!file||typeof file==='string'||file.size>3_000_000)return {status:400,data:{error:'INVALID_SOCIAL_IMAGE'}};
 const bytes=new Uint8Array(await file.arrayBuffer()),dims=jpegDimensions(bytes);
 if(!dims||dims.width<320||dims.width>2160||dims.height>3840)return {status:400,data:{error:'INVALID_SOCIAL_IMAGE'}};
 const state=await userClient.from('sm_state').select('value').eq('workspace_id',workspace).eq('key','sm_projects').maybeSingle();
 let item=null;
 for(const campaign of Array.isArray(state.data?.value)?state.data.value:[]){if(campaign.type!=='Campanha IA')continue;for(const candidate of campaign.items||[]){if(campaign.id+'-'+candidate.id===source)item=candidate;}}
 if(state.error||!item?.selected||!item.imagePath?.startsWith(workspace+'/generated/'))return {status:400,data:{error:'SOCIAL_SELECTION_REQUIRED'}};
 const story=item.format==='1080x1920',ratio=dims.width/dims.height;
 if(story?Math.abs(ratio-9/16)>.02:ratio<.8||ratio>1.91)return {status:400,data:{error:'INVALID_SOCIAL_FORMAT'}};
 if(!story&&(!item.caption?.trim()||item.caption.length>2200))return {status:400,data:{error:'SOCIAL_CAPTION_REQUIRED'}};
 const endpoint=new URL('https://connectors.windsor.ai/instagram/actions');endpoint.searchParams.set('api_key',key);
 // Discover supported actions before issuing any external write. Never log this URL.
 const actionId=story?'create_story':'create_image_post';
 try{const list=await fetcher(endpoint,{signal:AbortSignal.timeout(15000)});if(!list.ok)return {status:503,data:{error:'SOCIAL_ACCESS_DENIED'}};const actions=await list.json();if(!Array.isArray(actions)||!actions.some(a=>a.id===actionId))return {status:503,data:{error:'SOCIAL_ACTION_UNAVAILABLE'}};}catch{return {status:503,data:{error:'SOCIAL_ACCESS_DENIED'}};}
 const reserved=await admin.rpc('sm_social_reserve',{p_workspace:workspace,p_user:user.id,p_source:source});
 if(reserved.error)return {status:409,data:{error:reserved.error.message.includes('SOCIAL_ALREADY_SUBMITTED')?'SOCIAL_ALREADY_SUBMITTED':'SOCIAL_NOT_CONFIGURED'}};
 const jobId=reserved.data,storage=admin.storage.from('sm-ai-images');let submitted=false;
 try{
  const path=workspace+'/social/'+jobId+'.jpg';const upload=await storage.upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(upload.error)throw Error();
  const signed=await storage.createSignedUrl(path,3600);if(signed.error)throw Error();
  const params=story?{image_url:signed.data.signedUrl}:{image_url:signed.data.signedUrl,caption:item.caption};
  submitted=true;const result=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:account.data.account_id,action:actionId,params}),signal:AbortSignal.timeout(90000)});
  if(!result.ok)throw Error();const payload=await result.json();if(payload.error||payload.result==null)throw Error();
  const saved=await admin.from('sm_social_jobs').update({status:'submitted'}).eq('id',jobId);if(saved.error)throw Error();
  return {status:200,data:{status:'submitted',username:account.data.username,jobId}};
 }catch{await admin.from('sm_social_jobs').update({status:submitted?'unknown':'failed'}).eq('id',jobId);return {status:502,data:{error:submitted?'SOCIAL_RESULT_UNKNOWN':'SOCIAL_UPLOAD_FAILED'}};}
}
