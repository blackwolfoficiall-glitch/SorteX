# Backups

`scripts/backup-db.sh` exige `DATABASE_URL`, `BACKUP_DIR` e `APP_ENV`, cria dump custom sem sobrescrever e aplica permissão 600. `check-backup.sh` valida o catálogo e gera SHA-256. `restore-db.sh` exige confirmação interativa e uma frase adicional em produção.

Política sugerida: diário por 14 dias, semanal por 8 semanas e mensal por 12 meses; arquivos do storage devem seguir retenção equivalente. Teste restauração em ambiente isolado pelo menos mensalmente. Nenhum backup real é executado automaticamente nesta etapa.

## Ensaio isolado com documento sintético

Use ferramentas PostgreSQL de servidor e cliente compatíveis no `PATH`
(`initdb`, `pg_ctl`, `psql`, `pg_dump` e `pg_restore`). Como usuário comum,
na raiz do projeto:

```sh
(cd services/api && npm ci && npx prisma generate)
bash scripts/test-storage-backup-restore.sh
```

O comando usa exclusivamente um cluster PostgreSQL temporário vinculado a
`127.0.0.1` (porta 55494, ajustável por `SORTEX_RESTORE_TEST_PORT`). Ignora
`DATABASE_URL` do ambiente, prepara dois bancos vazios, migra somente a origem
e usa contas/arquivo exclusivamente sintéticos. Após fechar a API de origem,
gera um dump PostgreSQL custom e copia o volume privado. Restaura o dump em
transação, sem `--clean`, e os arquivos para outro diretório. O volume original
é retirado do caminho antes de subir a API de destino.

O teste confere documento, vínculo do organizador, migrações e auditoria
preservados; o mesmo SHA-256 no arquivo e nas respostas da nova API; dono e
revisor autorizados (200), anônimo (401) e outro organizador (403). Emite novas
chaves JWT sintéticas na API restaurada, rejeitando a sessão antiga. O dump e
os diretórios temporários são eliminados; não há backup real, dados pessoais,
Neon, S3, Next, iPhone, teste de recuperação de desastre ou certificação de
restauração em nuvem.
