# Backups

`scripts/backup-db.sh` exige `DATABASE_URL`, `BACKUP_DIR` e `APP_ENV`, cria dump custom sem sobrescrever e aplica permissão 600. `check-backup.sh` valida o catálogo e gera SHA-256. `restore-db.sh` exige confirmação interativa e uma frase adicional em produção.

Política sugerida: diário por 14 dias, semanal por 8 semanas e mensal por 12 meses; arquivos do storage devem seguir retenção equivalente. Teste restauração em ambiente isolado pelo menos mensalmente. Nenhum backup real é executado automaticamente nesta etapa.
