# Variáveis de ambiente

Obrigatórias em produção: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_URL`, `APP_URL`, `API_URL`, `CORS_ALLOWED_ORIGINS`. Segredos de gateway e SMTP tornam-se obrigatórios quando as integrações forem habilitadas.

Segurança: `AUTH_MAX_LOGIN_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`, `RATE_LIMIT_*`, `MAX_JSON_BODY_SIZE` e `MAX_FORM_BODY_SIZE`. Operação: `APP_VERSION`, `PORT`, `ORGANIZER_UPLOAD_DIR` e prazos financeiros/reserva.

Nunca versione `.env`, chaves privadas ou tokens. Use secret manager em produção e faça rotação documentada.
