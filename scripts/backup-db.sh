#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL obrigatória}"
: "${BACKUP_DIR:?BACKUP_DIR obrigatória}"
: "${APP_ENV:?APP_ENV obrigatória}"
case "$APP_ENV" in development|staging|production) ;; *) echo "APP_ENV inválido" >&2; exit 1;; esac
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/sortex-${APP_ENV}-${stamp}.dump"
test ! -e "$target" || { echo "Backup já existe" >&2; exit 1; }
echo "Criando backup do ambiente $APP_ENV em $target"
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$target"
chmod 600 "$target"
echo "Backup concluído: $target"
