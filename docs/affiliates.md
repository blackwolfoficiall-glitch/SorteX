# Afiliados e indicações — Módulo 9B

## Arquitetura

O domínio `affiliates` mantém programas, afiliados, links, cliques, conversões, comissões, solicitações e indicações separado do ledger do organizador. Nenhuma saída de dinheiro é executada.

## Atribuição e segurança

O código do afiliado é armazenado na reserva e validado novamente no backend. A conversão somente nasce dentro da transação que confirma um `Payment` como `APPROVED`. Existe unicidade por compra e pagamento. Autoindicação é bloqueada por padrão; IP e user-agent de cliques são reduzidos a hashes SHA-256.

O modelo padrão é `LAST_CLICK`, com duração configurável. A estrutura também comporta `FIRST_CLICK`, `COUPON` e `MANUAL`; a seleção completa entre múltiplos cliques ficará ativa após a migração e a implementação do cookie de atribuição na página pública.

## Comissões

- Percentual: percentual sobre o valor bruto efetivamente pago.
- Fixa: valor configurado multiplicado pela quantidade de títulos.
- Mista: percentual do bruto mais valor fixo por título.

Estorno e chargeback revertem conversão e comissão de forma idempotente. A liberação usa `availableAt`; não há pagamento automático.

## Rotas

Organizador: `/affiliate-programs`, `/affiliates`, `/affiliate-links`. Afiliado: `/affiliate/dashboard`, `/affiliate/links`, `/affiliate/conversions`, `/affiliate/commissions`, `/affiliate/payouts`. Administração: `/admin/affiliates`, `/admin/affiliate-conversions`, `/admin/affiliate-payouts`.

## Limitações

Não há Pix de saída, e-mail, WhatsApp, push, tributação ou antifraude externo. Cupons, materiais e programa de indicação possuem estrutura Prisma preparada, mas a experiência completa depende da migração futura e de etapas de produto posteriores.
