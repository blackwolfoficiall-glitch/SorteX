# Armazenamento privado na homologação

## Desenvolvimento ou instância isolada com disco persistente

Em desenvolvimento, a API prepara o diretório privado `./storage/organizers` (ou `ORGANIZER_UPLOAD_DIR`) quando os uploads estão habilitados. Se o diretório configurado faltar, a inicialização cria a raiz antes de anunciar os uploads como prontos. Não copia arquivos, nem altera permissões preexistentes. Arquivos locais novos usam modo 0600; diretórios novos usam modo 0700.

Para habilitar a mesma inicialização em uma **instância isolada com volume persistente privado**, definir `STORAGE_DRIVER=filesystem`, `ORGANIZER_UPLOAD_DIR` como caminho absoluto sob o volume montado e `UPLOADS_DISABLED=false`. O operador deve verificar a montagem persistente antes de iniciar. Não apontar para um diretório servido como conteúdo estático. Nunca configurar um disco temporário de função como armazenamento durável.

A rota `GET /health/ready` distingue `storage: "up"` (diretório gravável ou checagem do bucket), `"disabled"` (uploads desabilitados explicitamente) e `"not-initialized"` (diretório local ausente ou não utilizável). Isto não comprova retenção, disponibilidade de todos os objetos nem consistência entre objetos e banco. Para aceitar storage, fazer upload e download via API com conta de teste, conferir hash, comprovar que outra conta não lê e repetir após reinício.

## Ambiente hospedado

O código de implantação da revisão isolada Fase 1 mantém `UPLOADS_DISABLED=true` sem armazenamento durável configurado. Não mudar para `false` até verificar privacidade, credencial por ambiente e durabilidade em um bucket **isolado**. A opção existente `STORAGE_DRIVER=neon-s3` usa o bucket informado por `STORAGE_BUCKET` e o endpoint HTTPS e credenciais de serviço configurados no ambiente. Não incluir valores secretos no repositório, log, chat ou frontend.

Verificar a configuração do candidato autorizado, confirmar que o bucket não tem leitura pública, validar upload, leitura autorizada/negada e retenção após uma reinicialização e testar restauração isolada de registros do banco e objetos. Não compartilhar bucket ou credencial com produção. Não substituir arquivos existentes. A mudança é reversível mantendo as chaves e voltando a `UPLOADS_DISABLED=true` para parar novos uploads; isso não replica nem remove arquivos.

## Documentos de verificação

Somente o organizador dono ou administrador com permissão efetiva `ORGANIZERS_REVIEW` obtém o documento. Downloads administrativos autorizados são auditados. API e BFF não permitem o cache da resposta privada. Não usar URL pública do bucket para estes documentos.

Teste local com PostgreSQL descartável, nome começando por `sortex_storage_` e conexão somente ao loopback:

```sh
cd services/api
DATABASE_URL="$SORTEX_STORAGE_E2E_DATABASE_URL" npx prisma migrate deploy
npm run test:e2e -- --runInBand private-document-storage.e2e-spec.ts
```

Defina `SORTEX_STORAGE_E2E_DATABASE_URL` antes de executar. O teste utiliza documentos, usuários e credenciais sintéticos exclusivos. A execução aqui não habilita o ambiente remoto nem comprova backup, remoção e restauração hospedados.
