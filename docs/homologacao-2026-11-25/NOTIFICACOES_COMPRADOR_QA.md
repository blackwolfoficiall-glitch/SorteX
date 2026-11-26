# Caixa de notificações do comprador · Web + iOS

Escopo: abrir a caixa pelo início, ler o título/mensagem e marcar uma
notificação ou todas como lidas. A caixa exibe as 100 notificações ativas
mais recentes; a ação em lote aplica-se a todas as notificações ativas
da própria conta, também se houver outras mais antigas. Não há push,
e-mail, SMS, WhatsApp, links externos, envio ou criação de notificações
na tela.

As duas interfaces usam as rotas Nest existentes em `/buyer/notifications`.
Somente o comprador autenticado acessa a própria caixa; os avisos excluídos
não aparecem e não são alterados. Repetir a leitura preserva a primeira
data registrada. Os clientes recebem somente texto, estado e horário,
sem os metadados internos da notificação. A lista vem sem cache. Falha de
rede não vira caixa vazia nem confirmação da leitura. No app, mudança de
conta ou sessão invalida a resposta anterior.

## Repetir em ambiente descartável

- `cd apps/mobile && npm run typecheck && npm test` valida contrato e
  proteção contra resposta de sessão anterior.
- Em `services/api`, aplique as migrações a um PostgreSQL novo e descartável
  em `127.0.0.1`, cujo nome começa com `sortex_inbox_`. Passe essa URL em
  `SORTEX_INBOX_E2E_DATABASE_URL` e rode
  `npm run test:e2e -- --runInBand --runTestsByPath test/buyer-inbox.e2e-spec.ts`.
  A suíte cria compradores e avisos sintéticos e usa o cliente HTTP do app
  com memória, não um dispositivo ou o SecureStore.
- Para incluir o Next, inicie um build local em IPv4 loopback apontado
  ao mesmo Nest descartável: informe `SORTEX_INBOX_E2E_WEB_URL` e
  `SORTEX_INBOX_E2E_API_PORT` ao teste. A suíte verifica se o BFF aponta
  àquela instância antes de enviar as credenciais sintéticas.
- Para interagir com a interface web real, adicione
  `SORTEX_INBOX_E2E_BROWSER=1`. Use Chromium compatível com Playwright;
  se necessário, indique o executável em `SORTEX_INBOX_E2E_CHROMIUM_PATH`.
  O navegador abre a caixa pelo início, marca um aviso e depois todos,
  recarrega e verifica o estado que o cliente HTTP móvel também lê.

Esse escopo não conclui a jornada combinada de **notificações, favoritos
e suporte**. Também não comprova entrega de mensagens externas nem
execução da interface iOS no simulador ou no iPhone.
