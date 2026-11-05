import { build } from 'esbuild';
import { mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
const version = '1.2.0';
const commit = (process.env.COMMIT_REF || 'local').slice(0, 7);
const deploy = (process.env.DEPLOY_ID || 'local').slice(-8);
const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = 'v' + version + ' · ' + commit + ' · ' + deploy;
const details = 'Publicado em ' + date + ' (Brasília) | Commit ' + commit + ' | Deploy ' + deploy;
mkdirSync('dist', { recursive: true });
for (const path of ['app.js', 'style.css', 'assets']) cpSync(path, 'dist/' + path, { recursive: true });
const html = readFileSync('index.html', 'utf8').replace('<!-- STUDIO_BUILD -->', '<span id="app-version" title="' + escape(details) + '" aria-label="' + escape(details) + '">' + escape(label) + '</span>');
writeFileSync('dist/index.html', html);
console.log('StudioMídia ' + label);


const projectConfig = JSON.parse(readFileSync('supabase.public.json', 'utf8'));
const supabaseUrl = process.env.SUPABASE_URL || projectConfig.supabaseUrl;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || projectConfig.supabaseKey;
if (!supabaseUrl || !supabaseKey || new URL(supabaseUrl).protocol !== 'https:') throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no Netlify.');
let publicKey = supabaseKey.startsWith('sb_publishable_');
if (!publicKey && supabaseKey.split('.').length === 3) {
  try { publicKey = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
}
if (!publicKey) throw new Error('Use apenas uma chave publicável/anon. Chaves secretas nunca são incluídas no site.');
writeFileSync('dist/config.js', 'window.STUDIO_CONFIG=' + JSON.stringify({supabaseUrl, supabaseKey}) + ';');

await build({entryPoints:['cloud.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/cloud.js',minify:true});


await build({entryPoints:['ai.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/ai.js',minify:true});
