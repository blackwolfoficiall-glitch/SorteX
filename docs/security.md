# Segurança

Autenticação usa bcrypt com custo 12, access token curto, refresh token rotacionado e hash de refresh persistido. Reutilização revoga a sessão. Cinco falhas de login bloqueiam temporariamente a conta por padrão. Logout global e revogação remota estão disponíveis em `/auth/logout-all` e `/auth/sessions`.

O rate limit local distingue login, cadastro, recuperação, pagamentos, webhooks, mídia e suporte. Em múltiplas instâncias ele deve ser substituído por Redis. CORS aceita somente `CORS_ALLOWED_ORIGINS`; wildcard com credenciais não é permitido. Respostas recebem CSP, HSTS em produção, proteção de frame, MIME e referrer.

Erros são normalizados com `requestId`; stack, queries e segredos não são expostos em produção. Logs técnicos são JSON e não registram body. Dados financeiros, documentos e mídias privadas continuam sujeitos aos guards de domínio.

Riscos restantes: rate limit em memória não é distribuído; não existe WAF, antivírus nem pentest externo; CSP do frontend deve ser revisada com o domínio final; uploads exigem inspeção de conteúdo mais profunda antes de produção.
