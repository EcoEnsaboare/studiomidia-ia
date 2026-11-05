import {planCampaign,mergeCampaignPosts,campaignCsv} from './ai-plan.mjs';
const $=id=>document.getElementById(id),cloud=window.StudioCloud;
let enabled=false,busy=false,campaign=null,referenceFile=null,referencePathCache='',referencePreview='';
const errors={BRIEF_DAILY_LIMIT:'O limite de 1 análise de referência por dia foi atingido. Você pode editar o texto manualmente e gerar sua imagem.',AI_NOT_CONFIGURED:'A geração ainda aguarda ativação da conta de IA. Nenhuma imagem foi cobrada.',AI_NOT_ENABLED:'A geração ainda não está liberada para esta empresa.',AI_DAILY_LIMIT:'O limite diário desta empresa foi atingido.',AI_BUSY:'Já existe uma geração em andamento. Aguarde antes de solicitar outra.',AI_DUPLICATE_REQUEST:'Esta solicitação já foi recebida. Use Verificar resultado para não gerar outra cobrança.',PROVIDER_TIMEOUT:'A IA demorou a responder. Use Verificar resultado antes de solicitar outra imagem. Pode haver consumo na conta de IA.',PROVIDER_ACCESS_DENIED:'A conta de IA precisa de chave válida ou permissão para gerar imagens.',PROVIDER_LIMIT:'A conta de IA atingiu um limite ou está sem saldo.',INVALID_REFERENCE:'Envie uma imagem PNG, JPEG ou WebP de até 3 MB.',REFERENCE_UNAVAILABLE:'A referência não está disponível. Crie um novo planejamento com o arquivo.',CONNECTION_FAILED:'A conexão falhou. Se a geração já foi enviada, use Verificar resultado antes de tentar de novo.',SERVER_FAILED:'Não foi possível concluir. Use Verificar resultado antes de solicitar outra geração.',ACCESS_DENIED:'Sua conta não tem permissão para gerar nesta empresa.'};
function explain(e){return errors[e.message]||'Não foi possível concluir esta ação. Confira sua conexão e tente novamente.';}
function setStatus(text){$('ai-status').textContent=text;}
async function refreshStatus(){
 try{const data=await cloud.aiStatus();enabled=data.enabled;$('ai-availability').textContent=enabled?`Geração ativada • limite de ${data.dailyLimit} solicitações por dia`:'Aguardando ativação da conta de IA. Você já pode preparar e salvar seu planejamento.';}
 catch{enabled=false;$('ai-availability').textContent='Não foi possível consultar a disponibilidade da IA. O planejamento continua disponível.';}
 if(campaign)render();
}
async function saveCampaign(){
 await cloud.flush();
 const projects=cloud.read('sm_projects',[]),index=projects.findIndex(p=>p.id===campaign.id);
 const record=structuredClone(campaign);if(index<0)projects.unshift(record);else projects[index]=record;
 if(!await cloud.write('sm_projects',projects))throw new Error('SAVE_FAILED');
 window.dispatchEvent(new Event('studio-projects-updated'));
}
function form(action){const f=new FormData();f.set('action',action);return f;}
async function signed(path){const f=form('signed-image');f.set('path',path);return (await cloud.ai(f)).url;}
function element(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
function button(text,fn){const b=element('button',text,'secondary');b.type='button';b.onclick=fn;return b;}
function renderCampaignList(){
 const select=$('ai-saved');select.replaceChildren(new Option('Abrir campanha salva…',''));
 for(const p of cloud.read('sm_projects',[]).filter(p=>p.type==='Campanha IA'))select.add(new Option(p.title,p.id));
 if(campaign)select.value=campaign.id;
}
function render(){
 const container=$('ai-results');container.replaceChildren();if(!campaign)return;
 const heading=element('h3',campaign.title);container.append(heading,element('p','Planejamento guiado. Cada botão Gerar imagem solicita uma nova criação à IA. Os textos abaixo são editáveis e ainda não são legendas geradas por IA.','hint'));
 const tools=element('div',null,'ai-tools');
 const all=button('Planejar campanha inteira no calendário',async()=>{
  if(busy)return;busy=true;render();
  try{await cloud.flush();const posts=mergeCampaignPosts(cloud.read('sm_posts',[]),campaign);
   if(!await cloud.write('sm_posts',posts))throw new Error('SAVE_FAILED');
   window.dispatchEvent(new Event('studio-posts-updated'));setStatus('Campanha atualizada no calendário para revisão. Nenhuma publicação foi enviada às redes sociais.');
  }catch(e){setStatus(explain(e));}finally{busy=false;render();}
 });all.disabled=busy;
 const csv=button('Baixar planejamento CSV',()=>{
  const blob=new Blob(['\uFEFF'+campaignCsv(campaign)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=element('a');
  a.href=url;a.download='planejamento-'+campaign.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });tools.append(all,csv);container.append(tools);
 for(const item of campaign.items){
  const card=element('article',null,'ai-card');card.append(element('small',item.date.split('-').reverse().join('/')+' • '+item.service));
  const title=element('input');title.value=item.title;title.maxLength=100;title.setAttribute('aria-label','Título da arte');title.disabled=busy;
  const prompt=element('textarea');prompt.value=item.prompt;prompt.rows=3;prompt.maxLength=2500;prompt.setAttribute('aria-label','Descrição para a IA');prompt.disabled=busy;
  title.onchange=async()=>{item.title=title.value;try{await saveCampaign();}catch(e){setStatus(explain(e));}};
  prompt.onchange=async()=>{item.prompt=prompt.value;try{await saveCampaign();}catch(e){setStatus(explain(e));}};
  const date=element('input');date.type='date';date.value=item.date;date.setAttribute('aria-label','Data planejada');date.disabled=busy;
  const caption=element('textarea');caption.value=item.caption;caption.rows=3;caption.maxLength=2200;caption.setAttribute('aria-label','Legenda da publicação');caption.disabled=busy;
  date.onchange=async()=>{if(!date.value)return;item.date=date.value;try{await saveCampaign();}catch(e){setStatus(explain(e));}};
  caption.onchange=async()=>{item.caption=caption.value;try{await saveCampaign();}catch(e){setStatus(explain(e));}};
  card.append(element('label','Data planejada'),date,element('label','Título da arte'),title,element('label','Descrição para criar a imagem'),prompt,element('label','Legenda da publicação'),caption);
  if(item.imagePath||item.previousImagePath){
   const visiblePath=item.imagePath||item.previousImagePath;
   const img=element('img');img.alt='Cena original gerada por IA: '+item.title;img.loading='lazy';
   signed(visiblePath).then(url=>{img.src=url;}).catch(()=>{img.alt='Imagem salva. Clique em Usar na arte para abri-la novamente.';});
   card.append(img,element('p','Cena gerada por IA. Use o editor para aplicar o logo oficial e os textos.','hint'));
   const use=button('Usar na arte',async()=>{try{window.StudioEditor.useGeneratedImage(await signed(visiblePath),item.title,item.caption,item.format);}catch(e){setStatus(explain(e));}});use.disabled=busy;card.append(use);
  }
  const generate=button(item.imagePath?'Gerar outra imagem':'Gerar imagem',()=>generateItem(item));generate.disabled=!enabled||busy;card.append(generate);
  if(item.requestId&&!item.imagePath){const recover=button('Verificar resultado',()=>recoverItem(item));recover.disabled=busy;card.append(recover);}
  const calendar=button('Planejar no calendário',async()=>{
   await cloud.flush();const posts=mergeCampaignPosts(cloud.read('sm_posts',[]),{...campaign,items:[item]});
   if(await cloud.write('sm_posts',posts)){window.dispatchEvent(new Event('studio-posts-updated'));setStatus('Item atualizado no calendário para revisão. Isso não publica nas redes sociais.');}
  });calendar.disabled=busy;card.append(calendar);container.append(card);
 }
}
async function generateItem(item){
 if(busy||!enabled)return;
 if(!$('ai-consent').checked){setStatus('Marque a confirmação de uso da conta de IA antes de gerar.');$('ai-consent').focus();return;}
 if(item.prompt.trim().length<10){setStatus('Descreva a nova imagem com pelo menos 10 caracteres.');return;}
 if(item.requestId&&!item.imagePath){setStatus('Verifique o resultado da solicitação anterior antes de pedir uma nova imagem.');return;}
 if(item.imagePath&&!confirm('Gerar outra imagem é uma nova solicitação paga. Deseja continuar?'))return;
 busy=true;item.previousImagePath=item.imagePath||item.previousImagePath||null;item.imagePath=null;item.requestId=crypto.randomUUID();render();setStatus('Salvando sua solicitação…');
 try{
  await saveCampaign();
  const f=form('generate');f.set('prompt',item.prompt);f.set('requestId',item.requestId);f.set('size',item.format==='1080x1080'?'1024x1024':'1024x1536');f.set('consent','true');
  if(campaign.referencePath)f.set('referencePath',campaign.referencePath);
  setStatus('Criando uma imagem NOVA com IA. Aguarde; não feche esta página.');
  const result=await cloud.ai(f);item.imagePath=result.path;await saveCampaign();setStatus('Nova imagem gerada e salva na nuvem. Agora você pode aplicar sua marca no editor.');
 }catch(e){setStatus(explain(e));}
 finally{busy=false;render();renderCampaignList();}
}
async function recoverItem(item){
 if(busy)return;busy=true;render();
 try{
  const f=form('recover');f.set('requestId',item.requestId);const result=await cloud.ai(f);
  if(result.status==='succeeded'){item.imagePath=result.path;await saveCampaign();setStatus('Imagem recuperada e salva na campanha. Nenhuma nova geração foi solicitada.');}
  else if(result.status==='reserved'){setStatus('A solicitação ainda está em andamento. Aguarde e verifique novamente.');}
  else if(result.status==='unknown'){setStatus('O resultado ainda é incerto. Confira o consumo da conta de IA antes de solicitar novamente.');}
  else{item.requestId=null;await saveCampaign();setStatus('Não há imagem concluída para esta solicitação. Uma nova tentativa precisará de uma nova aprovação.');}
 }catch(e){setStatus(explain(e));}finally{busy=false;render();}
}
$('ai-reference').onchange=()=>{referenceFile=null;referencePathCache='';if(referencePreview)URL.revokeObjectURL(referencePreview);
 let img=$('ai-reference-preview');if(!img){img=element('img');img.id='ai-reference-preview';img.style.cssText='display:block;max-width:240px;max-height:240px;object-fit:contain;margin-top:12px';$('ai-reference-field').append(img);}
 const file=$('ai-reference').files[0];img.hidden=!file;if(file){referencePreview=URL.createObjectURL(file);img.src=referencePreview;img.alt='Imagem de referência selecionada';}
};
async function uploadReference(){
 const file=$('ai-reference').files[0];if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3_000_000)throw new Error('INVALID_REFERENCE');
 if(referenceFile===file&&referencePathCache)return referencePathCache;
 const f=form('upload-reference');f.set('reference',file);const result=await cloud.ai(f);referenceFile=file;referencePathCache=result.path;return result.path;
}
$('ai-describe').onclick=async()=>{
 if(busy)return;
 if(!enabled){setStatus('Atualize a disponibilidade da IA antes de solicitar a análise.');return;}
 if(!$('ai-reference').files[0]){setStatus('Selecione a imagem de referência primeiro.');return;}
 if(!confirm('Analisar esta imagem envia a referência à OpenAI e usa seus créditos da API. Limite de 1 análise por dia, separado do limite de imagens. Continuar?'))return;
 if($('ai-brief').value.trim()&&!confirm('Substituir a descrição atual pela sugestão da imagem?'))return;
 busy=true;$('ai-describe').disabled=true;$('ai-plan').disabled=true;$('ai-reference').disabled=true;setStatus('Analisando a imagem para sugerir a descrição…');
 try{const path=await uploadReference(),f=form('describe-reference');f.set('referencePath',path);f.set('requestId',crypto.randomUUID());f.set('consent','true');const result=await cloud.ai(f);$('ai-brief').value=result.description;setStatus('Descrição sugerida pela imagem. Revise o texto antes de salvar o planejamento. Nenhuma arte foi gerada.');}
 catch(e){setStatus(explain(e));}finally{busy=false;$('ai-describe').disabled=false;$('ai-plan').disabled=false;$('ai-reference').disabled=false;}
};
$('ai-mode').onchange=()=>{$('ai-reference-field').hidden=$('ai-mode').value!=='reference';$('ai-describe-field').hidden=$('ai-mode').value!=='reference';$('ai-reference').required=$('ai-mode').value==='reference';};
$('ai-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;busy=true;$('ai-plan').disabled=true;setStatus('Preparando planejamento…');
 try{
  const mode=$('ai-mode').value;let referencePath='';
  const services=[...document.querySelectorAll('input[name=ai-service]:checked')].map(e=>e.value);
  if(!services.length)throw new Error('INVALID_PLAN');
  if(mode==='reference'){
   referencePath=await uploadReference();
  }
  const month=$('ai-month').value;
  const items=planCampaign({mode,month,count:Number($('ai-count').value),services,brief:$('ai-brief').value,referencePath,format:$('ai-format').value});
  campaign={id:crypto.randomUUID(),type:'Campanha IA',title:'Campanha '+month.split('-').reverse().join('/'),date:new Date().toLocaleDateString('pt-BR'),mode,referencePath,items};
  await saveCampaign();renderCampaignList();setStatus('Planejamento salvo. Nenhuma imagem foi gerada ou cobrada. Revise cada descrição e solicite as imagens que desejar.');
 }catch(e){setStatus(e.message==='INVALID_PLAN'?'Confira mês, quantidade, descrição e selecione pelo menos um serviço.':explain(e));}
 finally{busy=false;$('ai-plan').disabled=false;render();}
};
$('ai-saved').onchange=()=>{if(busy)return;campaign=cloud.read('sm_projects',[]).find(p=>p.id===$('ai-saved').value)||null;render();};
$('ai-refresh').onclick=refreshStatus;
$('ai-month').value=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7);
document.querySelector('[data-page=ai]').addEventListener('click',()=>{renderCampaignList();refreshStatus();});
renderCampaignList();refreshStatus();

$('photoToAI').onclick=()=>{
 if(busy)return;
 const file=$('photoFile').files[0];
 document.querySelector('[data-page=ai]').click();$('ai-mode').value='reference';$('ai-mode').onchange();
 if(file){const transfer=new DataTransfer();transfer.items.add(file);$('ai-reference').files=transfer.files;$('ai-reference').onchange();setStatus('Referência selecionada. Escreva a descrição ou use Sugerir descrição pela imagem; prepare a campanha e clique em Gerar imagem no item.');}
 else setStatus('Selecione uma referência, descreva a campanha e prepare o planejamento. Depois clique em Gerar imagem no item.');
 $('ai-reference-field').scrollIntoView({behavior:'smooth',block:'center'});
};
