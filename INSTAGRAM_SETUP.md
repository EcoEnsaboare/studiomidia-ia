# Instagram: publicação imediata

A autorização no ChatGPT/Windsor não fornece uma credencial ao servidor do aplicativo. Salve WINDSOR_API_KEY em Supabase Edge Function Secrets, obtida em Windsor.ai Account Management / API Access. Nunca salve no GitHub ou frontend.

A conta permitida é definida por workspace na tabela sm_social_accounts, apenas pelo servidor. O aplicativo consulta a presença da chave, e cada envio exige selecionar e salvar a imagem/legenda e confirmar o destino. Publicar agora envia JPEG final com logo e contatos; Stories não recebem caption.

O servidor valida sessão, papel, seleção salva e formato, descobre a ação via GET e reserva a operação atomicamente. O mesmo item não é reenviado. Qualquer resultado ambíguo exige conferência manual no Instagram. Credencial usada somente entre servidor e API oficial Windsor e nunca registrada no log.

Status submitted significa envio aceito pela Windsor, não comprovação de visibilidade no Instagram. Não há agendamento automático nesta versão; dia/hora continuam planejamento. Nenhuma publicação real foi feita durante o desenvolvimento.
