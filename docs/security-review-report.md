# Revisão final de segurança

Esta revisão automatizada e de código **não substitui pentest profissional**.

## Controles validados em código/testes

- JWT, refresh com hash/rotação/revogação e bloqueio de força bruta.
- Guards de role/ADMIN e escopo por proprietário nos serviços principais.
- Webhooks idempotentes, valor e referência verificados no backend.
- Reserva com índice único e transações; sorteio determinístico e auditável.
- Rate limit, CORS por allowlist, headers, body limits e erros sanitizados.
- Upload com MIME, tamanho e proteção de path traversal.
- Logs sem body/token e dados financeiros não confiados ao frontend.

## Cenários automatizados existentes

Token inválido/revogado, roles, campanhas de outro organizador, compra de outro comprador, reserva duplicada, pagamento/webhook duplicado ou divergente, sorteio duplicado, ledger idempotente, payout e mídia privada.

## Ressalvas

- Rate limit/cache/jobs são locais e não coordenam múltiplas instâncias.
- Não houve DAST, CSRF em navegador, fuzzing de uploads ou pentest externo.
- Uploads ainda não possuem antivírus externo.
- CSP do frontend precisa ser validada no domínio final.
- Duas vulnerabilidades moderadas transitivas do PostCSS permanecem.
- Testes E2E completos dependem de banco isolado e navegador.

Classificação: **pronto com ressalvas para homologação controlada; bloqueado para produção pública**.
