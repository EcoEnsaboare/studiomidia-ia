# Etapa 1 em preparação — Login e nuvem

Esta branch contém a integração Supabase da versão 1.1.0. Ainda não está ativada em produção. Consulte [AUTH_SETUP.md](AUTH_SETUP.md) para configuração e validação de aceite.

Testes locais: `npm test` (inclui isolamento entre empresas em PostgreSQL/PGlite). Build: `npm run build`, com as duas variáveis públicas configuradas. Dependências têm versões fixas e lockfile.

---

## Histórico do piloto local

# StudioMídia — Plataforma de marketing (MVP piloto)

Protótipo funcional para a Eco Ensaboare, preparado para evoluir para uma plataforma multiempresa.

## Como abrir

1. Extraia o ZIP mantendo a estrutura de pastas.
2. Abra `index.html` no Chrome ou Edge.
3. Use **Minha marca** para configurar nome, telefone, cores e logotipo.
4. Use **Estúdio de Fotos** para montar e baixar uma arte PNG.
5. Use **Estúdio de Vídeos** para escolher até 12 vídeos, inserir texto e marca-d'água e exportar em WebM.
6. Use **Calendário** para registrar o planejamento editorial.

Para publicar como site, envie a pasta para Netlify Drop, Cloudflare Pages ou hospedagem estática equivalente. **Não publique informações sensíveis:** o protótipo não tem autenticação nem backend.

## O que funciona nesta versão

- Interface responsiva para computador e celular.
- Configuração de identidade visual (armazenamento local no navegador).
- Composição de imagens PNG com fotografia enviada, texto, logo, telefone e cores.
- Composição sequencial de até 12 vídeos com logo, texto e música enviada opcionalmente, com gravação WebM via MediaRecorder em navegador compatível.
- Calendário e biblioteca de registros salvos no armazenamento local.

## O que ainda NÃO está implementado

- Geração de imagens e vídeos novos por IA.
- Narração de voz sintética, exportação MP4.
- Login real, cadastro multiempresa, banco de dados e sincronização em nuvem.
- Publicação e agendamento automático no Instagram/Meta.
- Assinaturas e pagamentos recorrentes.
- Hospedagem e domínio configurados.

## Roteiro técnico para versão comercial

Stack sugerida: Next.js + TypeScript, Supabase (Auth, Postgres e Storage), fila de tarefas para renderização, FFmpeg no servidor, provedor de imagens IA, provedor TTS de português brasileiro, Meta Graph API e Stripe ou Mercado Pago. O backend deve guardar as chaves de API, impor limites por plano, controlar consentimento e proteger uploads por organização. Implementar logs, retenção de dados, LGPD e aprovação humana antes de publicar.

## Meta de 7 dias (escopo enxuto)

Dia 1: identidade, UX e protótipo. Dia 2: login e multiempresa. Dia 3: upload e estúdio de fotos com IA. Dia 4: pipeline de vídeo. Dia 5: narração, legendas e música. Dia 6: calendário, biblioteca e testes. Dia 7: homologação com Eco Ensaboare. Prazos dependem de desenvolvedor, contas externas, infraestrutura e aprovações; não constituem garantia.

## Observações

O projeto não envia arquivos para serviços externos por conta própria. Os registros ficam neste navegador, portanto podem desaparecer se os dados locais forem limpos. Salve os arquivos exportados no computador.

## Atualização 2 — novembro de 2026
- Seleção de até 12 vídeos para reprodução sequencial e exportação WebM em navegadores compatíveis.
- Controle de velocidade e visualização da lista de clipes.
- Nova seção de ideias e legendas com modelos de texto locais, edição, cópia e envio ao calendário.
- Não inclui geração real por IA, voz neural, MP4 ou publicação automática.

