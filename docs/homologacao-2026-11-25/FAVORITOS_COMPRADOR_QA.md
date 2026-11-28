# Favoritos privados do comprador · Web + iOS

No site, abra **Sorteios**, salve ou remova uma campanha e use **Meus
favoritos** para conferir a lista. No app, abra **Favoritos** pelo início
ou salve/remova pelo detalhe de uma campanha pública. Só o comprador
autenticado pode ler ou mudar sua própria lista. Falha de API não é
interpretada como lista vazia. O app não aplica resultados depois da troca
de conta/sessão.

São usados o modelo e a relação existentes. A lista só exibe campanhas
publicadas e sem bloqueio de publicação. Pausar, bloquear ou retirar a
publicação oculta o registro sem apagar o favorito, que pode voltar a
aparecer se a campanha for publicada novamente. Salvar/remover repetidamente
não cria duplicatas. O novo caminho `/buyer/favorites/private` e suas
mutações não fazem fallback para o caminho antigo em uma API desatualizada.
Na API atual, os caminhos históricos também adotam a mesma proteção.

Salvar um favorito não compartilha o comprador com o organizador, não cria
contato/interação no CRM e não envia avisos. A implementação não encontrou
aceite específico que autorizasse usar o favorito identificado; consentimento
genérico não é usado para isso. O histórico anterior não é alterado.

## Repetir em ambiente descartável

- `cd apps/mobile && npm run typecheck && npm test`.
- Em `services/api`, aplique as migrações a um PostgreSQL novo em
  `127.0.0.1`, com nome `sortex_favorites_*`. Defina
  `SORTEX_FAVORITES_E2E_DATABASE_URL` e rode
  `npm run test:e2e -- --runInBand --runTestsByPath test/buyer-favorites.e2e-spec.ts`.
- Para incluir o Next local, defina `SORTEX_FAVORITES_E2E_WEB_URL` e
  `SORTEX_FAVORITES_E2E_API_PORT` e aponte o BFF para o mesmo Nest. Para
  interagir com a interface web, adicione `SORTEX_FAVORITES_E2E_BROWSER=1`;
  se necessário indique o Chromium em `SORTEX_FAVORITES_E2E_CHROMIUM_PATH`.
  A suíte comprova que o BFF aponta para a instância descartável antes de
  enviar as credenciais sintéticas.

A jornada combinada **notificações, favoritos e suporte** continua parcial.
A execução do cliente HTTP do app não comprova a interface no iOS.
