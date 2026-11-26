#!/usr/bin/env bash
# Runs the named local test entry point while a loopback-only fixture exists.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${SORTEX_IOS_UI_PG_BIN:?Set PostgreSQL 18 binary directory}"
: "${RUNNER_TEMP:?Set an isolated temporary directory}"
: "${1:?Specify the local test entry point}"
pg="${SORTEX_IOS_UI_PG_BIN%/}"
test -x "$pg/postgres"
"$pg/postgres" --version | grep -Eq 'PostgreSQL\) 18(\.|$)'
tmp="$(mktemp -d "$RUNNER_TEMP/sortex-ios-ui.XXXXXX")"
api_pid=
db_started=0
cleanup() {
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true; fi
  if [[ "$db_started" == 1 ]]; then "$pg/pg_ctl" -D "$tmp/db" -m fast -w stop >/dev/null; fi
  rm -rf -- "$tmp"
}
trap cleanup EXIT
chmod 700 "$tmp"
if "$pg/pg_isready" -h 127.0.0.1 -p 55478 --timeout=1 >/dev/null; then
  echo 'Refusing to reuse an existing PostgreSQL listener.' >&2
  exit 1
fi
# Open an ephemeral socket first to check the exact API port; never trust a preexisting app.
node -e 'const s=require("node:net").createServer();s.on("error",()=>{console.error("Refusing to reuse an existing API listener.");process.exit(1)});s.listen(3338,"127.0.0.1",()=>s.close());'
db_password="$(openssl rand -hex 24)"
export SORTEX_IOS_UI_BUYER_PASSWORD="$(openssl rand -hex 24)"
printf '%s\n' "$db_password" > "$tmp/pg.password"
chmod 600 "$tmp/pg.password"
"$pg/initdb" -D "$tmp/db" --username=sortex_ios_ui --pwfile="$tmp/pg.password" \
  --auth-host=scram-sha-256 --auth-local=scram-sha-256 --locale=C --encoding=UTF8 >"$tmp/pg-init.log"
rm -f -- "$tmp/pg.password"
"$pg/pg_ctl" -D "$tmp/db" -l "$tmp/postgres.log" \
  -o "-h 127.0.0.1 -p 55478 -c unix_socket_directories=''" -w start >/dev/null
db_started=1
PGPASSWORD="$db_password" "$pg/createdb" -h 127.0.0.1 -p 55478 -U sortex_ios_ui sortex_ios_ui
export DATABASE_URL="postgresql://sortex_ios_ui:$db_password@127.0.0.1:55478/sortex_ios_ui"
unset db_password
export SORTEX_IOS_UI_SCOPE=disposable-loopback
export SORTEX_IOS_UI_API=http://127.0.0.1:3338
export SORTEX_IOS_UI_API_LOG="$tmp/api.log"
# Whitelist the environment for every backend/Prisma operation. No hosted keys
# or provider settings can be inherited; only the local subprocess sees JWT keys.
isolated=(
  env -i "HOME=$HOME" "PATH=$PATH" "TMPDIR=$tmp" CI=1
  "DATABASE_URL=$DATABASE_URL" "SORTEX_IOS_UI_SCOPE=$SORTEX_IOS_UI_SCOPE"
  "SORTEX_IOS_UI_BUYER_PASSWORD=$SORTEX_IOS_UI_BUYER_PASSWORD"
  "JWT_ACCESS_SECRET=$(openssl rand -hex 40)" "JWT_REFRESH_SECRET=$(openssl rand -hex 40)"
  NODE_ENV=development APP_ENV=staging INTEGRATIONS_MODE=sandbox PAYMENT_ENV=test
  EMAIL_DELIVERY_MODE=disabled FEATURE_REAL_PAYMENTS=false FEATURE_PAYOUTS=false FEATURE_EXTERNAL_CRM=false
  ENABLE_NATIVE_SANDBOX_PIX=0 PRISMA_USE_PG_ADAPTER=true UPLOADS_DISABLED=true
  "APP_VERSION=${GITHUB_SHA:-local-isolated}"
)
(cd "$root/services/api"
  "${isolated[@]}" node node_modules/prisma/build/index.js migrate deploy
)
"${isolated[@]}" node "$root/.github/native-ui/fixture.cjs" seed
"${isolated[@]}" node "$root/.github/native-ui/fixture.cjs" serve >"$SORTEX_IOS_UI_API_LOG" 2>&1 &
api_pid=$!
ready=0
for _ in {1..30}; do
  if ! kill -0 "$api_pid" 2>/dev/null; then break; fi
  if curl --noproxy '*' --fail --silent --max-time 3 "$SORTEX_IOS_UI_API/health/ready" |
    node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const v=JSON.parse(s);if(v.status!=="ready"||v.database!=="up"||v.storage!=="disabled")process.exitCode=1;}catch{process.exitCode=1;}})'; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo 'Disposable Nest API never reported ready with database up and storage disabled.' >&2
  exit 1
fi
# The UI/test subprocess needs only its disposable buyer password and loopback API.
export -n DATABASE_URL
"$@"
"${isolated[@]}" node "$root/.github/native-ui/fixture.cjs" verify "$SORTEX_IOS_UI_API_LOG"
