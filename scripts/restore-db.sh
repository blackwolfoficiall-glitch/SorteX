#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL obrigatória}"
: "${APP_ENV:?APP_ENV obrigatória}"
file="${1:?Informe o arquivo .dump}"
test -r "$file" || { echo "Arquivo não encontrado" >&2; exit 1; }
if [[ "$APP_ENV" == production && "${CONFIRM_PRODUCTION_RESTORE:-}" != "RESTORE_SORTEX_PRODUCTION" ]]; then echo "Restauração de produção exige CONFIRM_PRODUCTION_RESTORE" >&2; exit 1; fi
echo "Valide um backup atual antes de restaurar $APP_ENV."
read -r -p "Digite RESTAURAR para continuar: " answer
[[ "$answer" == RESTAURAR ]] || exit 1
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$file"
echo "Restauração concluída. Execute testes de integridade."
