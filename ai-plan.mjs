export function planCampaign({month,count,services,brief,mode,referencePath='',format='1080x1350'}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(count)||count<1||count>30||!Array.isArray(services)||!services.length||services.some(s=>typeof s!=='string'||s.length>100))throw new Error('INVALID_PLAN');
 if(typeof brief!=='string'||brief.trim().length<10||brief.length>1400||!['idea','reference'].includes(mode)||!['1080x1350','1080x1920','1080x1080'].includes(format))throw new Error('INVALID_PLAN');
 if(mode==='reference'&&!referencePath)throw new Error('REFERENCE_REQUIRED');
 const [year,m]=month.split('-').map(Number),days=new Date(Date.UTC(year,m,0)).getUTCDate();
 const angles=['Conforto da casa','Cuidados na rotina','Ambiente acolhedor','Detalhes que fazem diferença','Cuidado com cada fibra','Receba bem suas visitas','Renovação do ambiente','Atendimento profissional'];
 return Array.from({length:count},(_,i)=>{
  const service=services[i%services.length],theme=angles[i%angles.length],day=Math.min(days,1+Math.floor(i*days/count));
  return {id:crypto.randomUUID(),date:month+'-'+String(day).padStart(2,'0'),service,title:theme,caption:service+' com cuidado profissional. Solicite uma avaliação e conheça nosso atendimento.',
   prompt:`${brief.trim()}\nServiço: ${service}. Tema desta variação: ${theme}. Variação ${i+1} de ${count}: crie uma cena diferente das outras, com outro enquadramento e composição.`,format,imagePath:null,requestId:null};
 });
}

// Refresh campaign entries without duplicating dates or touching unrelated posts.
export function mergeCampaignPosts(posts,campaign){
 const result=structuredClone(posts);
 for(const item of campaign.items){
  const id='ai-'+campaign.id+'-'+item.id,index=result.findIndex(p=>p.id===id);
  const post={...(index>=0?result[index]:{}),id,date:item.date,type:'Foto',title:item.title,caption:item.caption,imagePath:item.imagePath||null};
  if(index<0)result.push(post);else result[index]=post;
 }
 return result;
}
export function campaignCsv(campaign){
 const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return [['Data','Serviço','Título','Legenda','Descrição da imagem','Imagem gerada'],...campaign.items.map(i=>[i.date,i.service,i.title,i.caption,i.prompt,i.imagePath?'Sim':'Não'])].map(row=>row.map(cell).join(';')).join('\r\n');
}
