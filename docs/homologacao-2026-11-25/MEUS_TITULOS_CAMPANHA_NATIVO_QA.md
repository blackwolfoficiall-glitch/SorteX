# Meus títulos na campanha · aplicativo nativo

Na tela de detalhes de uma campanha pública, o comprador autenticado pode abrir **Meus títulos nesta campanha** sem sair do app. A tela nativa separa carregamento, erro com nova tentativa e lista vazia, relê ao recuperar foco/primeiro plano e permite atualizar. Os títulos confirmados podem ser abertos no próprio pedido; lotes longos são paginados. O histórico geral e a área do organizador não mudam.

Site e app continuam usando o mesmo GET autenticado `/purchases/my`. Este já restringe o histórico ao comprador ativo; o app só conserva campos de exibição da campanha escolhida e descarta qualquer linha ou título incompatível com os identificadores de campanha, pedido e comprador. Só ordena e exibe cotas `SOLD` de pedidos `PAID`. Confirmações usam **Valor pago**; pedidos pendentes, cancelados, expirados e estornados não revelam números e usam **Valor do pedido**. A leitura descarta respostas e falhas que chegam depois de encerrar ou trocar a sessão, inclusive novo login na mesma conta.

## Evidências isoladas

- Suíte mobile: 96/96, incluindo cruzamento de contas e campanhas, cotas reservadas, estados sem pagamento, respostas tardias, vazio e erro de contrato. Verificação TypeScript, build local de Nest e exportação Expo iOS do bundle passaram.
- `apps/mobile/scripts/test-buyer-campaign-titles-local.ts`: usa o cliente HTTP real do app com **Nest e PostgreSQL descartável**, 22 migrações, sem requisições de provedor. A confirmação sintética do seed devolveu somente os números 42 e 314. Reserva sem pagamento e posterior cancelamento permaneceram sem números. Outra campanha e outro comprador ficaram isolados, e a leitura com a revisão revogada não foi usada. A contagem de pagamentos no PostgreSQL permaneceu em apenas 1 (registro sintético preexistente do seed).
- Para repetir, use uma instância real do backend em loopback com fixtures de `prisma/seed-staging.ts` (`SEED_PUBLIC_BROWSER_REWARDS=true`) e banco descartável inicializado. Execute o script pelo workspace mobile com `SORTEX_NATIVE_LOCAL_CONFIRM=synthetic-loopback-only`, `SORTEX_NATIVE_CAMPAIGN_TITLES_API=http://127.0.0.1:<porta>` e `TEST_SEED_PASSWORD` já carregada no ambiente de teste. Não use o QA compartilhado, credenciais reais ou provedor.

**Limite:** esses testes comprovam a API e a projeção consumida pelo app, não a navegação em um iPhone, integração de pagamentos ou aceitação completa de uma jornada nativa. Nenhum deploy.
