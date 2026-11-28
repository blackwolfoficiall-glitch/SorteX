#!/usr/bin/env bash
# Disposable local proof only. Never accepts an existing cluster, DSN or volume.
set -euo pipefail
umask 077
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo/services/api"

for tool in initdb pg_ctl psql pg_dump pg_restore node npm; do
  command -v "$tool" >/dev/null || { echo "Ferramenta necessária: $tool" >&2; exit 1; }
done
port="${SORTEX_RESTORE_TEST_PORT:-55494}"
if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1024 || 10#$port > 65535 )); then
  echo "Porta local deve estar entre 1024 e 65535." >&2
  exit 1
fi
port=$((10#$port))

# The ephemeral cluster and all explicit client calls only use IPv4 loopback.
while IFS= read -r key; do unset "$key"; done < <(compgen -v PG)
temporary="$(mktemp -d "${TMPDIR:-/tmp}/sortex-backup-proof.XXXXXXXX")"
cleanup() {
  if [[ -f "$temporary/cluster/postmaster.pid" ]]; then
    if ! pg_ctl -D "$temporary/cluster" -m fast -w stop >/dev/null 2>&1; then
      echo "Não foi possível parar o cluster sintético; diretório temporário preservado." >&2
      return 1
    fi
  fi
  rm -rf -- "$temporary"
}
trap cleanup EXIT
role=sortex_restore_fixture
nonce="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(6).toString("hex"))')"
source_db="sortex_storage_backup_$nonce"
target_db="sortex_storage_restore_$nonce"

initdb --pgdata="$temporary/cluster" --username="$role" --auth=trust   --encoding=UTF8 --no-locale >"$temporary/initdb.log" 2>&1 || {
  echo "Não foi possível inicializar o PostgreSQL descartável (execute como usuário comum)." >&2; exit 1;
}
pg_ctl -D "$temporary/cluster" -l "$temporary/postgres.log" -w -t 20   -o "-h 127.0.0.1 -p $port -c unix_socket_directories=''" start >/dev/null || {
  echo "Não foi possível abrir o cluster descartável nessa porta local." >&2; exit 1;
}
psql -X -w -q -h 127.0.0.1 -p "$port" -U "$role" -d postgres   -v ON_ERROR_STOP=1 -c "CREATE DATABASE $source_db" -c "CREATE DATABASE $target_db"

export SORTEX_STORAGE_E2E_DATABASE_URL="postgresql://$role@127.0.0.1:$port/$source_db"
export SORTEX_STORAGE_RESTORE_E2E_DATABASE_URL="postgresql://$role@127.0.0.1:$port/$target_db"
export DATABASE_URL="$SORTEX_STORAGE_E2E_DATABASE_URL" PRISMA_USE_PG_ADAPTER=true
# Only the source receives Prisma migrations. The target must stay empty for pg_restore.
./node_modules/.bin/prisma migrate deploy
npm run test:e2e -- --runInBand --runTestsByPath test/private-document-storage.e2e-spec.ts
