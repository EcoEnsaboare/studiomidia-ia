import {planCampaign} from './ai-plan.mjs';
const $=id=>document.getElementById(id),cloud=window.StudioCloud;
let enabled=false,busy=false,campaign=null,dailyLimit=1,referencePreview='',socialReady=false,socialUsername='';
const errors={SOCIAL_NOT_CONFIGURED:'A integração precisa de WINDSOR_API_KEY no servidor.',SOCIAL_ACCESS_DENIED:'A Windsor.ai recusou o acesso. Confira a chave e as permissões de escrita.',SOCIAL_ALREADY_SUBMITTED:'Esta imagem já foi enviada ou tem resultado pendente. Confira o Instagram antes de qualquer nova publicação.',SOCIAL_RESULT_UNKNOWN:'O envio foi iniciado, mas o resultado não pôde ser confirmado. Confira seu Instagram; não repita o envio.',SOCIAL_SELECTION_REQUIRED:'Salve e selecione esta imagem antes de publicar.',SOCIAL_CAPTION_REQUIRED:'Preencha e salve a legenda antes de publicar.',AI_NOT_CONFIGURED:'A IA precisa ser ativada no servidor.',AI_DAILY_LIMIT:'O limite diário de imagens foi atingido. As opções já criadas continuam salvas.',AI_BUSY:'Uma imagem ainda está em geração.',AI_DUPLICATE_REQUEST:'Solicitação já recebida. Use Verificar resultado.',PROVIDER_TIMEOUT:'A IA demorou a responder. Use Verificar resultado; não solicite outra imagem ainda.',PROVIDER_LIMIT:'A API está sem saldo ou atingiu um limite.',PROVIDER_ACCESS_DENIED:'A API precisa de chave válida e acesso ao modelo.',INVALID_REFERENCE:'Envie PNG, JPEG ou WebP de até 3 MB.',CONNECTION_FAILED:'Conexão interrompida. Use Verificar resultado se a imagem já foi solicitada.'};
function withContacts(caption){if(!caption)return '';const brand=cloud.read('sm_brand',{});const contacts=[brand.phone,brand.website,brand.instagram,brand.email].filter(Boolean).join('\n');return (caption+(contacts?'\n\n'+contacts:'')).slice(0,2200);}
const status=text=>{$('ai-status').textContent=text;};
const explain=e=>errors[e.message]||'Não foi possível concluir. Sua criação continua salva; confira a conexão.';
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function btn(text,fn){const b=el('button',text,'secondary');b.type='button';b.onclick=fn;b.disabled=busy;return b;}
function form(action){const f=new FormData();f.set('action',action);return f;}
async function signed(path){const f=form('signed-image');f.set('path',path);return (await cloud.ai(f)).url;}
async function save(){await cloud.flush();const rows=cloud.read('sm_projects',[]),i=rows.findIndex(p=>p.id===campaign.id);if(i<0)rows.unshift(structuredClone(campaign));else rows[i]=structuredClone(campaign);if(!await cloud.write('sm_projects',rows))throw new Error('SAVE_FAILED');window.dispatchEvent(new Event('studio-projects-updated'));list();}
function list(){const select=$('ai-saved');select.replaceChildren(new Option('Abrir criação…',''));for(const p of cloud.read('sm_projects',[]).filter(p=>p.type==='Campanha IA'))select.add(new Option(p.title,p.id));if(campaign)select.value=campaign.id;}
function lock(value){busy=value;for(const e of $('ai-form').querySelectorAll('input,textarea,select,button'))e.disabled=value;$('ai-saved').disabled=value;render();}
async function availability(){try{const d=await cloud.aiStatus();enabled=d.enabled;dailyLimit=d.dailyLimit;$('ai-availability').textContent=enabled?`IA ativada · limite atual: ${dailyLimit} imagem(ns) por dia`:d.missingConfiguration?.length?'Configuração pendente: '+d.missingConfiguration.join(' e '):'IA não liberada para esta empresa.';}catch{enabled=false;$('ai-availability').textContent='Não foi possível consultar a IA. Tente Atualizar status.';}render();}
function field(card,label,input){const l=el('label',label);l.append(input);card.append(l);input.disabled=busy;}
async function change(item,key,value){item[key]=value;try{await save();}catch(e){status(explain(e));}}
async function finalCanvas(item){return window.StudioEditor.renderGenerated(await signed(item.imagePath),item.title,item.format);}
function render(){const box=$('ai-results');box.replaceChildren();if(!campaign)return;
 const ready=campaign.items.filter(i=>i.imagePath),selected=ready.filter(i=>i.selected);
 box.append(el('h3','2 · Selecione as imagens'),el('p',`${ready.length} imagem(ns) criada(s) · ${selected.length} selecionada(s).`));
 const grid=el('div',null,'creation-gallery');box.append(grid);
 for(const item of campaign.items){const card=el('article',null,'ai-card');grid.append(card);
  if(item.imagePath){const preview=el('div',null,'creation-preview');card.append(preview);finalCanvas(item).then(canvas=>{if(preview.isConnected){canvas.setAttribute('aria-label','Arte com logo e contatos: '+item.title);preview.replaceChildren(canvas);}}).catch(()=>{preview.textContent='Não foi possível carregar a prévia. Reabra esta criação.';});
   const choose=el('input');choose.type='checkbox';choose.checked=Boolean(item.selected);choose.onchange=async()=>{await change(item,'selected',choose.checked);render();};field(card,'Selecionar esta imagem',choose);
   if(item.selected){card.append(el('h4','3 · Revise a publicação'));
    const caption=el('textarea');caption.rows=7;caption.maxLength=2200;caption.value=item.caption||'';caption.onchange=()=>change(item,'caption',caption.value);field(card,item.captionSource==='ai'?'Legenda gerada pela imagem · edite se desejar':'Legenda · escreva antes de preparar',caption);
    if(item.captionSource!=='ai')card.append(el('p','A legenda automática não foi concluída. A imagem foi preservada.','hint'));
    const title=el('input');title.value=item.title;title.maxLength=100;title.onchange=async()=>{await change(item,'title',title.value);render();};field(card,'Chamada na imagem',title);
    const date=el('input');date.type='date';date.value=item.date;date.onchange=()=>{if(date.value)change(item,'date',date.value);};field(card,'Dia',date);
    const time=el('input');time.type='time';time.value=item.time||'09:00';time.onchange=()=>change(item,'time',time.value);field(card,'Horário de Brasília',time);
    const publish=btn(item.socialStatus==='submitted'?'Enviada ao Instagram':'Publicar agora no Instagram',()=>publishItem(item));publish.disabled=busy||!socialReady||Boolean(item.socialStatus);card.append(publish);
    card.append(btn('Baixar imagem com marca e contatos',async()=>{try{const c=await finalCanvas(item);c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='ecoensaboare-'+item.id+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}catch(e){status(explain(e));}}),btn('Copiar legenda',async()=>{try{await navigator.clipboard.writeText(item.caption||'');status('Legenda copiada.');}catch{status('Selecione e copie a legenda no campo acima.');}}));
   }
  }else{card.append(el('p',item.requestId?'Solicitação em processamento ou aguardando verificação.':'Opção ainda não gerada.'));
   if(item.requestId)card.append(btn('Verificar resultado',()=>recover(item)));
   else{const b=btn('Gerar esta opção e sua legenda',()=>run([item]));b.disabled=busy||!enabled;card.append(b);}
  }
 }
 if(ready.length){const prepare=btn('Salvar selecionadas com dia e horário',async()=>{
  if(selected.some(i=>!i.date||!i.time||!i.caption?.trim())){status('Preencha legenda, dia e horário de todas as imagens selecionadas.');return;}
  lock(true);try{await cloud.flush();let posts=cloud.read('sm_posts',[]);const prefix='ai-'+campaign.id+'-';posts=posts.filter(p=>!String(p.id).startsWith(prefix)||selected.some(i=>prefix+i.id===p.id));
   for(const i of selected){const id=prefix+i.id,post={id,date:i.date,time:i.time,timeZone:'America/Sao_Paulo',type:'Foto',title:i.title,caption:i.caption,imagePath:i.imagePath,format:i.format,status:'prepared',selected:true},index=posts.findIndex(p=>p.id===id);if(index<0)posts.push(post);else posts[index]={...posts[index],...post};}
   if(!await cloud.write('sm_posts',posts))throw new Error('SAVE_FAILED');await save();window.dispatchEvent(new Event('studio-posts-updated'));status('Selecionadas salvas com legenda, dia e horário. Status: preparadas. O agendamento automático ainda não está ativado. Use Publicar agora para envio imediato.');
  }catch(e){status(explain(e));}finally{lock(false);}
 });prepare.className='primary';box.append(prepare,el('p','Preparado no sistema ≠ agendado no Instagram. O envio automático por horário ainda não está ativado.','hint'));}
}
async function generate(item){
 item.requestId=crypto.randomUUID();await save();const f=form('generate');f.set('prompt',item.prompt);f.set('requestId',item.requestId);f.set('size',item.format==='1080x1080'?'1024x1024':'1024x1536');f.set('consent','true');f.set('withCaption','true');if(campaign.referencePath)f.set('referencePath',campaign.referencePath);
 const result=await cloud.ai(f);item.imagePath=result.path;item.caption=withContacts(result.caption);item.captionSource=result.caption?'ai':'pending';item.selected=false;item.time='09:00';await save();
}
async function run(items){if(busy||!enabled)return;if(!$('ai-consent').checked){status('Marque a autorização de uso de créditos antes de gerar.');return;}lock(true);
 try{for(let n=0;n<items.length;n++){status(`Criando opção ${n+1} de ${items.length} e sua legenda…`);await generate(items[n]);render();}status('Imagens e legendas salvas. Selecione as imagens desejadas para revisar dia e horário.');}
 catch(e){status(explain(e));}finally{lock(false);}
}
async function recover(item){if(busy)return;lock(true);try{const f=form('recover');f.set('requestId',item.requestId);const r=await cloud.ai(f);if(r.status==='succeeded'&&r.path){item.imagePath=r.path;item.caption=withContacts(r.caption);item.captionSource=r.caption?'ai':'pending';item.time=item.time||'09:00';await save();status('Imagem recuperada sem nova geração.');}else if(r.status==='failed'||r.status==='not_found'){item.requestId=null;await save();status('Não há imagem concluída. Uma nova tentativa precisa de créditos e está sujeita ao limite diário.');}else status('Resultado ainda não confirmado. Aguarde antes de solicitar outra imagem.');}catch(e){status(explain(e));}finally{lock(false);}}
$('ai-mode').onchange=()=>{$('ai-reference-field').hidden=$('ai-mode').value!=='reference';};
$('ai-reference').onchange=()=>{if(referencePreview)URL.revokeObjectURL(referencePreview);let img=$('ai-reference-preview');if(!img){img=el('img');img.id='ai-reference-preview';img.style.cssText='display:block;max-width:200px;max-height:180px;object-fit:contain';$('ai-reference-field').append(img);}const file=$('ai-reference').files[0];img.hidden=!file;if(file){referencePreview=URL.createObjectURL(file);img.src=referencePreview;img.alt='Modelo selecionado';}};
$('ai-form').onsubmit=async e=>{e.preventDefault();if(busy)return;await availability();if(!enabled){status('A IA ainda não está disponível. Confira o status acima.');return;}if(!$('ai-consent').checked){status('Marque a autorização de uso de créditos.');return;}
 const count=Number($('ai-count').value),mode=$('ai-mode').value,brief=$('ai-brief').value.trim()||(mode==='reference'?'Crie uma nova arte de higienização inspirada no tema e estilo do modelo, com outra cena e composição.':'');
 if(brief.length<10){status('Escreva uma ideia com pelo menos 10 caracteres.');return;}
 if(count>dailyLimit){status(`O limite atual é ${dailyLimit} imagem(ns) por dia. Escolha uma quantidade dentro desse limite para este teste.`);return;}
 lock(true);try{let referencePath='';if(mode==='reference'){const file=$('ai-reference').files[0];if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3_000_000)throw new Error('INVALID_REFERENCE');const f=form('upload-reference');f.set('reference',file);referencePath=(await cloud.ai(f)).path;}
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}),items=planCampaign({month:today.slice(0,7),count,services:['Higienização profissional'],brief,mode,referencePath,format:$('ai-format').value});for(const i of items){i.date=today;i.time='09:00';i.caption='';}
 campaign={id:crypto.randomUUID(),type:'Campanha IA',title:brief.slice(0,65),date:new Date().toLocaleDateString('pt-BR'),mode,referencePath,items};await save();for(let n=0;n<items.length;n++){status(`Gerando imagem ${n+1} de ${items.length} e sua legenda…`);await generate(items[n]);render();}status('Pronto. Selecione as imagens que deseja usar e revise as legendas.');
 }catch(error){status(explain(error));}finally{lock(false);}
};
$('ai-saved').onchange=()=>{if(busy)return;campaign=cloud.read('sm_projects',[]).find(p=>p.id===$('ai-saved').value)||null;render();};
$('ai-refresh').onclick=availability;document.querySelector('[data-page=ai]').addEventListener('click',()=>{list();availability();});
$('photoToAI').onclick=()=>{if(busy)return;document.querySelector('[data-page=ai]').click();const file=$('photoFile').files[0];if(file){$('ai-mode').value='reference';$('ai-mode').onchange();const d=new DataTransfer();d.items.add(file);$('ai-reference').files=d.files;$('ai-reference').onchange();}status('Escolha a quantidade e clique em Gerar imagens e legendas.');};
list();availability();

async function socialStatus(){try{const data=await cloud.ai(form('social-status'));socialReady=data.configured;socialUsername=data.username||'';$('social-availability').textContent=socialReady?'Integração configurada para @'+socialUsername+'. A publicação só ocorre ao confirmar cada imagem.':data.missingKey?'@'+(data.username||'ecoensaboare')+' autorizada na Windsor.ai. Falta salvar WINDSOR_API_KEY nos Secrets do Supabase para o aplicativo usar esse acesso.':'Conta ainda não liberada para publicação neste aplicativo.';}catch{socialReady=false;$('social-availability').textContent='Não foi possível verificar a integração. Tente novamente.';}render();}
async function publishItem(item){
 if(busy||!socialReady||!item.selected||item.socialStatus)return;
 if(!confirm('Publicar AGORA esta imagem '+(item.format==='1080x1920'?'nos Stories (sem legenda)':'no Feed com a legenda exibida')+' da conta @'+socialUsername+'? A arte e, no Feed, a legenda serão enviadas à Windsor.ai e ao Instagram.'))return;
 lock(true);try{await save();const canvas=await finalCanvas(item),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob||blob.size>3_000_000)throw new Error('INVALID_REFERENCE');const f=form('publish-instagram');f.set('sourceId',campaign.id+'-'+item.id);f.set('publishConsent','true');f.set('finalImage',blob,'post.jpg');const data=await cloud.ai(f);item.socialStatus=data.status;await save();status('Envio aceito pela Windsor.ai para @'+socialUsername+'. Confira o resultado no Instagram antes de publicar novamente.');}
 catch(e){status(explain(e));}finally{lock(false);}
}
$('social-refresh').onclick=socialStatus;socialStatus();
