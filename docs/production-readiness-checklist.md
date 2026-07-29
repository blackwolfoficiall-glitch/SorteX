# Checklist de prontidão para produção

Este checklist é deliberadamente manual. A existência deste documento não significa que a SorteX esteja aprovada para produção.

## Plataforma e dados

- [ ] Migrações revisadas, testadas em homologação e com plano de rollback.
- [ ] Backup completo criado e restauração testada.
- [ ] Retenção de banco e arquivos definida por ambiente.
- [ ] Índices e consultas críticas validados com volume representativo.
- [ ] Solicitações LGPD e anonimização testadas sem apagar registros obrigatórios.

## Segurança

- [ ] Segredos fortes cadastrados no cofre do ambiente, nunca no repositório.
- [ ] HTTPS, HSTS, CORS e cookies seguros validados no domínio final.
- [ ] Rate limit distribuído e configuração de proxy confiável revisados.
- [ ] Webhooks validados com assinatura e idempotência em homologação.
- [ ] Uploads privados, retenção e varredura de malware definidos.
- [ ] Revisão de dependências, SAST, pentest e teste de autorização concluídos.
- [ ] Conta administrativa de emergência protegida e auditada.

## Pagamentos e operação

- [ ] Credenciais e contas de homologação separadas das de produção.
- [ ] PIX, cartão, expiração, estorno e chargeback testados ponta a ponta.
- [ ] Conciliação de pagamento, compra, títulos e ledger validada.
- [ ] Nenhum pagamento, repasse ou prêmio real habilitado antes da aprovação formal.
- [ ] Política de sorteio, resultado não vendido e contestação publicada.

## Infraestrutura

- [ ] Domínios, DNS, certificados e origens CORS finais configurados.
- [ ] Banco, armazenamento, cache e filas de produção provisionados.
- [ ] Jobs idempotentes executados por workers distribuídos com dead-letter.
- [ ] Logs centralizados, métricas, alertas e rastreamento configurados.
- [ ] Health checks conectados ao orquestrador sem expor segredos.
- [ ] Capacidade, carga, limites e escalabilidade testados em homologação.

## Produto e conformidade

- [ ] Termos, política de privacidade, consentimentos e atendimento LGPD aprovados.
- [ ] Conteúdo público não expõe CPF, telefone, e-mail, documentos ou dados bancários.
- [ ] Fluxos de suporte, incidente e comunicação com usuários testados.
- [ ] Acessibilidade e navegação mobile revisadas nos navegadores suportados.

## Liberação e rollback

- [ ] CI da revisão aprovado sem ignorar testes ou vulnerabilidades relevantes.
- [ ] Versão, changelog e responsável pela liberação definidos.
- [ ] Smoke test de homologação concluído.
- [ ] Plano de rollback ensaiado e janela de manutenção comunicada.
- [ ] Aprovação final técnica, operacional, financeira e jurídica registrada.
