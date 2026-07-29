# Resposta a incidentes

1. Classificar impacto e preservar evidências.
2. Revogar sessões/segredos comprometidos sem apagar logs.
3. Isolar funcionalidade afetada: pagamentos, webhook, sorteio, financeiro ou uploads.
4. Comunicar responsáveis e registrar cronologia.
5. Recuperar com backup validado ou rollback revisado.
6. Reconciliar pagamentos, tickets, ledger e sorteios antes de reabrir.
7. Produzir análise de causa e ações preventivas.

Vazamento exige bloqueio de acesso, rotação de segredos e avaliação LGPD. Pagamento divergente ou saldo inconsistente deve suspender repasses. Sorteio contestado deve preservar snapshots e hashes. Nenhuma ação destrutiva é automatizada.
