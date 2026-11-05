# Etapa 1 — contas e nuvem (aguardando ativação)

Esta branch prepara a versão 1.1.0. Não concluir a etapa ou iniciar a IA até passar pela validação real abaixo.

## Ativação

1. Selecionar a organização Supabase e consultar o custo antes de criar o projeto `studiomidia-ia`. Não criar recurso pago sem aprovação do valor.
2. Inspecionar as tabelas do projeto selecionado; aplicar `database/workspaces.sql` como uma migração única no projeto vazio. Registrar a versão retornada pelo Supabase.
3. Rodar os advisors de segurança. Confirmar que `sm_private` não está na lista de schemas expostos.
4. Auth: e-mail/senha, confirmação de e-mail ativada, senha mínima de 10 caracteres, login anônimo desativado. Configurar Site URL e redirecionamento exato `https://ecoensaboare.netlify.app/`. Configurar SMTP de produção para confirmação e recuperação.
5. Netlify: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (apenas chave publicável ou anon). Não usar service_role, senha de banco nem chave secreta. O build recusa chaves privilegiadas e omite SQL/testes do diretório publicado.
6. Executar testes, conferir o deploy de preview e então integrar à main. O endereço de produção permanece o mesmo.

## Validação de aceite antes de concluir

- Cadastro e confirmação com uma conta real; senha definida pelo usuário, nunca em chat ou em commits.
- Login, logout, renovação de sessão e recuperação de senha.
- Criar calendário, salvar marca e conferir os mesmos dados em outro navegador/aparelho.
- Duas contas de empresas diferentes não podem ler/gravar os dados uma da outra via API.
- Sessão anônima não lê nem grava dados; RPC sem sessão é recusado.
- Edição concorrente retorna conflito e não sobrescreve silenciosamente os dados remotos.
- Falha de rede não exibe mensagem de salvamento concluído.
- Importação do piloto é explícita; originais não são apagados do navegador.

## Limites desta etapa

Os registros de projetos, calendário e marca são salvos na nuvem. Fotos/vídeos de origem e arquivos exportados ainda são locais. Esta etapa não inclui renderização de vídeo no servidor, IA ou postagem em redes sociais. O esquema contempla membros por empresa; convites e administração de equipe ainda não têm interface.

## Verificação local

`npm ci && npm test`. Para build, definir variáveis públicas de ambiente e executar `npm run build`. Os testes locais não substituem o aceite com Supabase Auth real.
