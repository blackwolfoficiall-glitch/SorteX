# Relatório de prontidão final — v0.1.0-beta

| Área | Classificação | Motivo |
|---|---|---|
| Arquitetura e builds | Pronto com ressalvas | Compila; lint legado pendente. |
| Banco | Depende de migração | Schema amplo sem incremental consolidada. |
| Autenticação | Pronto com ressalvas | Testes passam; E2E de navegador pendente. |
| Campanhas/compras | Pronto com ressalvas | Unitários passam; concorrência com PostgreSQL staging pendente. |
| Pagamentos | Depende de serviço externo | Somente sandbox/mock; dinheiro real bloqueado. |
| Sorteios | Depende de teste manual | Motor auditável; produção bloqueada. |
| Financeiro | Pronto com ressalvas | Ledger testado; conciliação staging pendente. |
| Admin | Pronto com ressalvas | Protegido por role; revisão manual completa pendente. |
| Afiliados/CRM/mídia | Pronto com ressalvas | Sem envio, payout ou renderização pesada real. |
| Mobile/acessibilidade | Depende de teste manual | Build passa; matriz visual não automatizada. |
| Segurança | Pronto com ressalvas | Pentest, Redis, antivírus e observabilidade externa pendentes. |
| Jurídico/privacidade | Depende de validação jurídica | Termos e operação promocional precisam de advogado/contador. |
| Produção pública | Bloqueado | Migração, lint, staging, operação, jurídico e testes finais. |

## Decisão

A base pode avançar para **homologação isolada e piloto sem dinheiro real**, depois de provisionar staging, gerar/revisar migração e concluir os checklists. Não está pronta para produção pública.
