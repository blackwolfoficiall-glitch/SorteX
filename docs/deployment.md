# Deployment e checklist de produção

O repositório possui Dockerfiles separados e `docker-compose.yml` para ambiente controlado. O CI valida Prisma, lint, testes, typecheck e builds; não realiza deploy.

Checklist obrigatório: migrações revisadas e com rollback; segredos fortes; HTTPS; CORS e domínio final; gateway homologado; assinatura do webhook; SMTP; armazenamento persistente; backup e restauração testados; monitoramento; rate limit distribuído; termos e privacidade versionados; conta administrativa de emergência; teste de carga; aprovação financeira e plano de rollback.

Este checklist nunca deve ser marcado automaticamente. Produção permanece bloqueada até revisão humana.
