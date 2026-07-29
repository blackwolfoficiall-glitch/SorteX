# Relatório de validação financeira

## Cobertura existente

- Planos Básico 2,9%, Profissional 2,4% e Premium 1,9%.
- Taxa personalizada, taxa zero e primeira campanha gratuita.
- Gateway fee separada da taxa SorteX.
- Ledger idempotente, saldos, repasse manual, estorno e chargeback.

Os testes unitários passam, mas não houve conciliação contra gateway ou banco de homologação. Nenhum valor real foi movimentado.

## Validações obrigatórias em homologação

- Bruto igual a taxa SorteX + gateway + líquido do organizador.
- Referências únicas e nenhum webhook contabilizado duas vezes.
- Saldos compatíveis com lançamentos, sem negativos implícitos.
- Payout nunca concluído automaticamente e sempre auditado.

Classificação: **pronto com ressalvas**, dependente de migração e teste integrado.
