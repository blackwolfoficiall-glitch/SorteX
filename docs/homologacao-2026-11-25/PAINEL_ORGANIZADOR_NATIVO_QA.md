# Painel do organizador no iOS · indicadores internos

Ao entrar como organizador, o início mostra contagens reais de campanhas,
títulos em pedidos pagos e compradores únicos com pedidos pagos. O valor
bruto vem dos pedidos registrados como pagos. Não representa saldo
disponível, liquidação pelo provedor, split ou repasse. **Consultar financeiro e
extrato** abre a consulta interna existente; **Minhas campanhas** abre a aba
de campanhas existente. A lista resume as três campanhas alteradas mais
recentemente e mostra bloqueio quando aplicável.

**Campanhas ativas** inclui publicadas ou esgotadas ainda sem bloqueio de
publicação. Esgotar não significa campanha encerrada ou resultado apurado.
As campanhas bloqueadas ainda aparecem para o próprio organizador, identificadas
como bloqueadas, e não contam como ativas. O total inclui os rascunhos e demais
estados pertencentes à conta. Não há mudança no processo de aprovação.

O aplicativo usa GET `/dashboard`, o mesmo endpoint que o BFF do site.
Os dados não são armazenados em cache; o painel lê novamente ao voltar à
tela ou ao atualizar. Trocar de conta invalida as respostas anteriores,
mesmo se a mesma pessoa encerrar e abrir outra sessão. Falha de API ou
um formato antigo sem o estado de bloqueio mostra indisponibilidade, não
saldo ou contagens zeradas. Zero é exibido somente quando a API devolve zero
válido.

## Repetir a prova local

- `cd apps/mobile && npm run typecheck && npm test`.
- Em `services/api`, use PostgreSQL migrado, novo e descartável, em IPv4
  loopback, com nome `sortex_dashboard_*`. Defina
  `SORTEX_DASHBOARD_E2E_DATABASE_URL` e execute
  `npm run test:e2e -- --runInBand --runTestsByPath test/organizer-dashboard-postgres.e2e-spec.ts`.
- Para incluir o BFF, inicie o build Next local apontando somente para o
  Nest descartável. Passe `SORTEX_DASHBOARD_E2E_WEB_URL` e
  `SORTEX_DASHBOARD_E2E_API_PORT` ao teste. Antes do login sintético, a
  versão aleatória do teste confirma que o Next aponta para a API local.

Os pedidos dos testes são registros sintéticos; não são pagamentos efetuados.
A prova HTTP evidencia dados compartilhados e isolamento, não renderização
do painel no iPhone, nem aceite da jornada financeira completa.
