# Backoffice Administrativo SorteX

## Primeiro Superadministrador local

O cadastro administrativo não é público e nenhuma senha fixa existe no código. No banco local de desenvolvimento, execute dentro de `services/api`:

```bash
ALLOW_CREATE_SUPERADMIN=true \
SUPERADMIN_NAME="Nome da pessoa" \
SUPERADMIN_EMAIL="admin@exemplo.com" \
SUPERADMIN_PASSWORD="uma-senha-local-com-12-ou-mais" \
npm run admin:create-superadmin
```

Se o e-mail já existir, o comando recusa a promoção por padrão. Para uma promoção deliberada, adicione `ALLOW_PROMOTE_EXISTING_ADMIN=true`. O comando é bloqueado quando `NODE_ENV` ou `APP_ENV` for `production` e registra auditoria.

## Regra oficial da taxa SorteX

O backend deve resolver a taxa nesta ordem: taxa específica da campanha; condição individual do organizador; taxa padrão do plano; taxa global padrão. A isenção nunca altera a tarifa do gateway. A primeira campanha gratuita deve registrar a campanha consumidora e não pode ser reutilizada.

## Gateways e cobranças

As configurações administrativas desta etapa funcionam em sandbox. Split e cobrança consolidada estão preparados como capacidades, mas produção permanece bloqueada até validação de credenciais e webhooks reais.
