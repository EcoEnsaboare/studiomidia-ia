// Business data stays in memory until confirmed by the database. Only the Auth
// SDK persists its session; legacy pilot records require explicit import.
const byId = id => document.getElementById(id);
const clone = value => structuredClone(value);
let client, workspace, userId, started = false, loading = false, recovering = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
let state = {}, revisions = {}, queue = Promise.resolve(), pending = 0, failed = false;
const gate = byId('auth-gate'), layout = document.querySelector('.layout');
const status = text => { byId('cloud-status').textContent = text; };
const message = text => { byId('auth-message').textContent = text; };
function lock() { gate.hidden = false; layout.hidden = true; }
function setMode(mode) {
  byId('auth-mode').value = mode;
  byId('company-field').hidden = mode !== 'signup';
  byId('auth-company').required = mode === 'signup';
  byId('auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  byId('auth-submit').textContent = ({login:'Entrar',signup:'Criar minha conta',recovery:'Salvar nova senha'})[mode];
  byId('auth-title').textContent = ({login:'Entre no seu estúdio',signup:'Crie sua conta',recovery:'Defina sua nova senha'})[mode];
  byId('email-field').hidden = mode === 'recovery';
  byId('auth-email').required = mode !== 'recovery';
  byId('auth-switch').hidden = mode === 'recovery';
  byId('auth-switch').textContent = mode === 'signup' ? 'Já tenho uma conta' : 'Criar uma conta';
  byId('auth-reset').hidden = mode !== 'login';
  message('');
}
async function readState() {
  const {data,error} = await client.from('sm_state').select('key,value,revision').eq('workspace_id',workspace);
  if(error) throw error;
  state={}; revisions={};
  for(const row of data) { state[row.key]=row.value; revisions[row.key]=row.revision; }
}
async function openWorkspace(session) {
  if(!session) { if(started) location.reload(); else lock(); return; }
  if(recovering || loading || (started && userId===session.user.id)) return;
  loading=true; message('Carregando seus projetos…');
  try {
    if(userId && userId!==session.user.id) { location.reload(); return; }
    const company=session.user.user_metadata?.company_name || 'Minha empresa';
    const {data,error}=await client.rpc('sm_ensure_workspace',{company_name:company});
    if(error) throw error;
    workspace=data; userId=session.user.id;
    await readState();
    window.StudioCloud = {
      companyName:company,
      workspaceId:workspace,
      flush:()=>queue,
      async ai(form){
        form.set('workspace',workspace);
        const {data,error}=await client.functions.invoke('generate-image',{body:form});
        if(error){let code='CONNECTION_FAILED';try{const body=await error.context?.json();code=body?.error||code;}catch{}throw new Error(code);}
        return data;
      },
      async aiStatus(){
        const {data:sessionData}=await client.auth.getSession();
        const response=await fetch(window.STUDIO_CONFIG.supabaseUrl+'/functions/v1/generate-image?workspace='+encodeURIComponent(workspace),{headers:{apikey:window.STUDIO_CONFIG.supabaseKey,Authorization:'Bearer '+sessionData.session?.access_token},cache:'no-store'});
        if(!response.ok)throw new Error('STATUS_UNAVAILABLE');
        return response.json();
      },
      read:(key,fallback)=>clone(state[key] ?? fallback),
      async write(key,value) {
        if(failed) { alert('Recarregue a página antes de continuar a edição.'); return false; }
        const snapshot=clone(value); pending++; status('Salvando na nuvem…');
        const operation=queue.then(async()=>{
          if(failed) throw new Error('Previous save failed');
          const {data,error}=await client.rpc('sm_save_state',{p_workspace:workspace,p_key:key,p_value:snapshot,p_revision:revisions[key]||0});
          if(error) throw error;
          state[key]=snapshot; revisions[key]=data;
        });
        queue=operation.catch(()=>{});
        try { await operation; pending--; if(!pending&&!failed) status('Salvo na nuvem'); return true; }
        catch(error) {
          pending--; failed=true; status('Não salvo — recarregue antes de continuar');
          window.dispatchEvent(new Event('studio-save-error'));
          alert(error.code==='40001' ? 'Há uma alteração mais recente em outro aparelho. Esta alteração não foi salva. Recarregue a página antes de editar novamente.' : 'Não foi possível salvar na nuvem. Esta alteração não foi salva. Confira sua conexão e recarregue a página.');
          return false;
        }
      }
    };
    if(!started) {
      const script=document.createElement('script'); script.src='app.js';
      await new Promise((resolve,reject)=>{ script.onload=resolve; script.onerror=reject; document.body.append(script); });
      const aiScript=document.createElement('script');aiScript.type='module';aiScript.src='ai.js';
      await new Promise((resolve,reject)=>{aiScript.onload=resolve;aiScript.onerror=reject;document.body.append(aiScript);});
      started=true;
    }
    byId('session-email').textContent=session.user.email;
    byId('workspace-name').textContent=company;
    byId('legacy-import').hidden=!['sm_brand','sm_posts','sm_projects'].some(key=>localStorage.getItem(key));
    gate.hidden=true; layout.hidden=false; status('Salvo na nuvem'); message('');
  } catch { lock(); message('Não foi possível abrir seus projetos. Tente novamente.'); }
  finally { loading=false; }
}
byId('auth-switch').onclick=()=>setMode(byId('auth-mode').value==='login'?'signup':'login');
byId('auth-form').onsubmit=async event=>{
  event.preventDefault(); if(!client) return;
  const submit=byId('auth-submit'); submit.disabled=true; message('Aguarde…');
  const email=byId('auth-email').value.trim(), password=byId('auth-password').value, mode=byId('auth-mode').value;
  try {
    if(mode==='signup') {
      const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/',data:{company_name:byId('auth-company').value.trim()}}});
      if(error) throw error;
      if(data.session) await openWorkspace(data.session);
      else message('Confira seu e-mail para confirmar o cadastro. Depois volte aqui e entre.');
    } else if(mode==='recovery') {
      const {error}=await client.auth.updateUser({password}); if(error) throw error;
      recovering=false; setMode('login'); const {data}=await client.auth.getSession(); await openWorkspace(data.session);
    } else {
      const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
      await openWorkspace(data.session);
    }
  } catch { message(mode==='login'?'Não foi possível entrar. Confira e-mail, senha e confirmação do cadastro.':'Não foi possível concluir. Confira os dados, a conexão e tente novamente.'); }
  finally { byId('auth-password').value=''; submit.disabled=false; }
};
byId('auth-reset').onclick=async()=>{
  if(!client) return;
  const email=byId('auth-email').value.trim(); if(!email||!byId('auth-email').reportValidity()) {message('Informe seu e-mail primeiro.');return;}
  const button=byId('auth-reset'); button.disabled=true;
  try {
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'}); if(error) throw error;
    message('Se houver uma conta para este e-mail, você receberá as instruções de recuperação.');
  } catch {message('Não foi possível solicitar a recuperação agora. Tente mais tarde.');}
  finally {button.disabled=false;}
};
byId('cloud-logout').onclick=async()=>{
  if(pending) {alert('Aguarde o término do salvamento antes de sair.');return;}
  const {error}=await client.auth.signOut(); if(error) {status('Não foi possível sair. Tente novamente.');return;}
  location.reload();
};
byId('legacy-import').onclick=async()=>{
  if(!confirm('Importar a marca, calendário e registros deste navegador para a conta conectada? Os dados atuais da conta serão substituídos. Os arquivos exportados não serão enviados.')) return;
  byId('legacy-import').disabled=true;
  try {
    for(const key of ['sm_brand','sm_posts','sm_projects']) {
      const raw=localStorage.getItem(key); if(!raw) continue;
      const value=JSON.parse(raw);
      if(!await window.StudioCloud.write(key,value)) return;
    }
    alert('Importação concluída. Os dados antigos continuam neste navegador como cópia.'); location.reload();
  } catch {alert('Não foi possível importar todos os dados. Os originais continuam neste navegador.');}
  finally {byId('legacy-import').disabled=false;}
};
window.addEventListener('beforeunload',event=>{if(pending){event.preventDefault();event.returnValue='';}});
window.addEventListener('offline',()=>status('Sem conexão — alterações precisam de internet'));
lock(); setMode(recovering?'recovery':'login');
try {
  const config=window.STUDIO_CONFIG;
  if(!config?.supabaseUrl||!config?.supabaseKey) throw new Error('Unconfigured');
  const {createClient}=await import('@supabase/supabase-js');
  client=createClient(config.supabaseUrl,config.supabaseKey);
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY') {recovering=true;lock();setMode('recovery');}
    else setTimeout(()=>openWorkspace(session),0);
  });
  const {data,error}=await client.auth.getSession(); if(error) throw error;
  await openWorkspace(data.session);
} catch {message('O acesso à nuvem ainda não está disponível. Tente novamente mais tarde.');byId('auth-submit').disabled=true;}

