# Evidências registradas

## 25/11/2026 · execução local HTTP, não é aceite iOS

| Verificação | Esperado | Observado |
|---|---|---|
| Versão e banco | Next e cliente móvel atingem a mesma API de teste | Mesma versão no rewrite /api/health e cliente móvel; prontidão do banco confirmada pelo BFF |
| Cadastro no site → cliente móvel | Login reconhece o mesmo usuário e perfil | HTTP 201 no cadastro; mesmo ID de usuário `cmwwa3v3z0000pe4m1ala9e40` e perfil `cmwwa3v400001pe4mtxpff39o` |
| Cadastro no cliente móvel → site | Sessão BFF reconhece exatamente a conta criada | HTTP 200 no login web; mesmo ID de usuário `cmwwa3vda0005pe4msxfj5eq7` e perfil `cmwwa3vda0006pe4mq30w1wfs` |
| Criar e editar rascunho entre clientes | Mesmo ID e título alterado persistido | `cmwwa3y1v000zpe4mtuzpx59j`, leitura no cliente móvel e persistência confirmada pelo site |
| Isolamento | Segundo organizador não lista nem edita o rascunho | Ausente na listagem; PATCH 403; rascunho inalterado |
| Logout | Encerra a sessão em ambos os clientes móveis de teste | Dois POST /auth/logout retornaram 201, cliente deixa de estar autenticado |

Execução de 15:29:04 UTC no código de integração sobre `6f8ba34`, com resolvedor e script ainda na cópia de trabalho. PostgreSQL 18.7 isolado com 19 migrações, sem banco preexistente e sem acesso a pagamento real. O armazenamento reportou `up` por existir diretório local, o que não prova upload, armazenamento hospedado ou recuperação.
