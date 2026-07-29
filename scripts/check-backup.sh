#!/usr/bin/env bash
set -euo pipefail
file="${1:?Informe o arquivo .dump}"
test -s "$file" || { echo "Backup vazio ou ausente" >&2; exit 1; }
pg_restore --list "$file" >/dev/null
sha256_file="${file}.sha256"
if command -v shasum >/dev/null; then shasum -a 256 "$file" > "$sha256_file"; else sha256sum "$file" > "$sha256_file"; fi
echo "Estrutura válida. Hash: $sha256_file"
