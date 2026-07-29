# Plano de rollback

## Aplicação

1. Fechar cadastro/campanhas e desativar flags de risco.
2. Interromper workers e novos webhooks, preservando eventos recebidos.
3. Reimplantar a última imagem homologada da API e do frontend.
4. Executar smoke tests e reabrir somente funções seguras.

## Banco

- Não usar `migrate reset`.
- Migração de schema deve ter SQL revisado e backup verificado.
- Preferir migração corretiva; restauração completa exige aprovação e janela.
- Validar compatibilidade da versão anterior antes de restaurar.

## Arquivos e integrações

- Preservar versões de assets e restaurar somente inventário confirmado.
- Desabilitar webhook no gateway antes de trocar endpoint; reprocessar idempotentemente.
- Nunca repetir pagamento, payout ou sorteio para “corrigir” estado.

## Critérios

Rollback quando houver corrupção, divergência financeira, autenticação indisponível, perda de arquivos, sorteio inconsistente ou regressão crítica sem correção segura imediata.
