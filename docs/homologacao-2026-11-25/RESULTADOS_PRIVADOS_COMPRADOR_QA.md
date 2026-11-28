# Resultados do comprador: histórico privado e avaliação

Site: **Perfil → Resultados**. No iOS: guia **Resultados**. Ambos passam por
`GET /buyer/results/my` com autenticação de comprador. O site usa o BFF
`GET /api/buyer/results/my`. Ambas as respostas são privadas e sem cache.

A API deriva a identidade da sessão, exige pedido pago e título vendido da
mesma campanha e do mesmo comprador, e retorna apenas resultados confirmados
de campanhas em estado público. Resultados normais de campanhas que não estão
públicas continuam indisponíveis. Quando houver indicação de ganhador na
resposta, ela é da própria conta e respeita a autorização de divulgação.

A única exceção é a simulação privada `sortex-review-v1-c3`, marcada como
fictícia no título, nos dois snapshots do banco, como cancelada e bloqueada
para compras, sem publicação, confirmação ou extração oficial. A exceção
só opera com os sinalizadores já presentes na homologação: aplicação em
staging, pagamentos e integrações em sandbox, pagamentos e sorteios reais
desativados. A tela nunca apresenta a simulação como apuração ou premiação
confirmada. Não há mudança de rotas públicas, aprovação, emissão, sorteio
ou pagamentos.

## Testes e pré-requisitos de publicação

- O cenário `services/api/test/buyer-draw-results-postgres.e2e-spec.ts` exige
  PostgreSQL local e vazio, com as migrações da candidata aplicadas (ver
  `SORTEX_PRIVATE_RESULTS_E2E_DATABASE_URL`). Veja nele as opções para passar
  o mesmo teste pelo BFF Next.js local. Abrange dono, conta alheia, organizador,
  anônimo, campanha não publicada, título inconsistente, pedido vencido,
  ausência do marcador, ausência de cada sinalizador, valores com zeros à
  esquerda e ausência de pagamento.
- A etapa nova não adiciona migração ou chave. A API hospedada em
  `48eeb858` não tem a rota: é preciso lançar uma revisão que contenha este
  commit e cumprir os gates de migração/promoção já previstos para a
  candidata. A presença das campanhas no banco não é evidência de que esta
  rota foi publicada. O app preserva a leitura legada de resultados públicos
  em caso de 404; a página nova exibe aviso de versão incompatível. Nenhuma
  alteração em ambiente compartilhado foi feita neste trabalho.
