# Financeiro da SorteX

## Arquitetura

O módulo financeiro usa um ledger interno separado do saldo informado pelo gateway. Somente um pagamento validado como `APPROVED` pelo webhook pode criar lançamentos. A criação ocorre dentro da mesma transação Prisma que confirma compra e títulos.

`CommercialTermsService` é a fonte única das regras de taxa. Ele considera plano, taxa personalizada, primeira campanha gratuita, isenção do organizador e isenção da campanha. A taxa do gateway permanece separada.

## Ledger de uma venda

Uma aprovação cria referências únicas para venda bruta, taxa SorteX, taxa estimada do gateway, receita líquida pendente do organizador e receita da plataforma. Os três primeiros registros são classificadores informativos e não duplicam saldo. A entrada `ORGANIZER_NET_REVENUE` movimenta o saldo pendente; `PLATFORM_REVENUE` movimenta a conta SorteX. A chave `payment:{id}:organizer-net` garante idempotência.

## Saldos e disponibilidade

- `pendingBalance`: receita confirmada aguardando prazo.
- `availableBalance`: receita liberada para solicitação.
- `blockedBalance`: valor reservado por repasse ou risco.

Os prazos são configurações de desenvolvimento, não promessas do gateway: `FINANCE_PIX_AVAILABLE_DAYS`, `FINANCE_DEBIT_AVAILABLE_DAYS` e `FINANCE_CARD_AVAILABLE_DAYS`.

`BalanceAvailabilityService` foi preparado para uma rotina recorrente. O overview também libera lançamentos vencidos de forma transacional. Em produção deverá existir um job dedicado.

## Solicitações de repasse

O fluxo não transfere dinheiro. O organizador verificado solicita ao menos `MIN_PAYOUT_AMOUNT`; o valor passa de disponível para bloqueado. O destino é mascarado antes de persistir no snapshot público. Apenas `REQUESTED` pode ser cancelado pelo organizador.

O administrador pode aprovar, rejeitar, marcar como processando e marcar manualmente como concluído. Nenhum repasse é concluído automaticamente. Rejeição devolve o saldo; conclusão encerra o bloqueio.

## Ajustes e mensalidades

Ajustes são exclusivos de `ADMIN`, exigem justificativa e geram `FinancialAdjustment`, `LedgerEntry` e `AuditLog`. Débitos negativos são recusados. `Subscription` e `SubscriptionInvoice` preparam planos e faturas, sem cobrança recorrente.

## Relatórios

O organizador consulta overview, extrato paginado, campanhas, taxas e repasses, com exportação JSON/CSV. Lucro por campanha é estimativa (`líquido - prêmio estimado`) e não deve ser confundido com saldo disponível.

## Segurança e limitações

- cálculos não confiam no frontend;
- destinos exibidos são mascarados;
- não há Pix de saída, split, saque, conciliação ou transferência real;
- gateway fee permanece uma estimativa do Módulo 5;
- tipos de estorno e chargeback estão preparados, mas o processamento completo depende da evolução do gateway;
- produção exige revisão contábil, jurídica e operacional.
