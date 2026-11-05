# Etapa 2 — geração original de imagens (ativação paga pendente)

## Implementado

- Área Criar com IA com dois modos: ideia e imagem de referência.
- Planejamento de até 30 publicações para um mês; a preparação usa modelos locais e não chama a IA.
- Cada imagem é solicitada individualmente. Referências privadas por empresa; cenas geradas salvas no Storage e campanhas em sm_projects.
- Usar na arte abre a cena nova no editor existente, onde são aplicados o logo oficial transparente, chamada e contato. Os PNGs gerados pela IA não recebem um logo redesenhado pelo modelo.
- Modelo servidor: gpt-image-2.5-flare, qualidade medium, uma imagem por solicitação, tamanhos 1024x1024 ou 1024x1536.
- Supabase Edge Function generate-image exige JWT e valida usuário e vínculo owner/editor da empresa. Quota atômica, bloqueio de concorrência e idempotência por request_id. Falhas e resultados incertos contam para o limite e nunca são repetidos automaticamente.
- Somente o servidor usa OPENAI_API_KEY e a credencial de serviço padrão do Supabase. Nenhum desses segredos vai para o build do navegador.

## Ativação (não realizada)

1. Na conta OpenAI API, confirmar acesso ao modelo e orçamento. A cobrança é por tokens de entrada/saída de imagem e texto; a referência acrescenta consumo. Consultar https://developers.openai.com/api/docs/pricing e o calculador em https://developers.openai.com/api/docs/guides/image-generation antes de autorizar o piloto.
2. Configurar OPENAI_API_KEY nos secrets da Edge Function do Supabase, nunca em chat, código público ou variável de frontend.
3. Depois de aprovação explícita do custo/limite pelo responsável, configurar STUDIO_AI_ENABLED=true e habilitar sm_ai_access apenas para a empresa autorizada. Quota inicial de 5 solicitações/dia (inclui erros/incertos), máximo 30. Não habilitar contas novas automaticamente.
4. Testar uma geração por ideia e uma com referência com a conta real; recuperar a mesma solicitação sem duplicar cobranças; validar o resultado e o PNG final com marca.

## Situação e testes

Schema de quotas e bucket privado aplicados no Supabase. Função implantada com verify_jwt=true. Nenhuma geração real paga foi realizada nesta implantação. A interface mostra o estado de ativação e mantém os botões pagos bloqueados até a configuração completa.

16 testes locais passaram (incluindo PostgreSQL/PGlite e chamadas ao provedor simuladas); build passou. Isso não substitui o teste real da API após cadastrar a chave.

Aviso existente do Supabase Auth: proteção contra senhas vazadas desativada. Revisar no painel quando disponível: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Não há alerta de RLS nas novas tabelas.

## Limitações

Geração de imagens, não de vídeo. Legendas desta tela são modelos locais editáveis. O calendário é planejamento para revisão e não agenda nem publica nas redes sociais. O custo final do provedor varia; a quota de solicitações não é um teto monetário garantido. Não há geração em lote paga ao abrir ou preparar uma campanha.
