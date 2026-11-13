# SorteX — continuidade pelo iPhone

> Registro da auditoria anterior, preservado. Este arquivo foi incorporado ao checkout da branch `infra/netlify-northflank-neon`; as afirmações abaixo sobre ausência de checkout e autorização somente documental descrevem aquela etapa. Para a migração autorizada depois, consulte `SORTEX_MIGRACAO_GRATUITA.md`. Nenhum estado do Mac foi conferido nesta sessão.

## Prompt atual para continuar a migração

```text
Continue a migração da SorteX no repositório original
https://github.com/blackwolfoficiall-glitch/SorteX,
branch infra/netlify-northflank-neon. Confirme HEAD e estado do ambiente
antes de executar comandos. A main deve ser preservada, sem merge/force push.

Leia primeiro docs/SORTEX_MIGRACAO_GRATUITA.md e depois os quatro documentos
de continuidade. Os textos abaixo deste prompt preservam a auditoria anterior;
a autorização atual também permite código, commits/push na branch de migração
e deploy exclusivamente gratuito, sem cartão, cobranças ou recursos Render.

Preserve Next.js, NestJS, Node, Prisma, PostgreSQL e migrations. A branch
infra/free-homologacao e alterações/dados exclusivos do Mac ainda não foram
recuperados. Não recrie essa branch nem apresente dados fictícios como antigos.

A preparação e testes locais foram realizados; publicação remota aguarda
acessos. Netlify Free tem o projeto sortex-homologacao criado, sem deploy
confirmado. O 403 de escrita foi corrigido ao usar todos os escopos no plano
Free; não pedir token para isso. Falta vincular o GitHub no painel Netlify,
operação não exposta pela integração. Neon precisa de conexão de conta:
esta é a única ação solicitada agora. Preços e documentos de billing da
Northflank divergem; a alternativa selecionada é Back4app Containers Free,
com Docker, 256 MB e sem cartão, sujeito a validação real de capacidade e
armazenamento. Conduzir os acessos um por vez, sem pedir segredos no chat.

Confirme planos e ausência de cobranças antes de criar recursos. Configure
segredos diretamente nos serviços, nunca no chat/Git. Pagamentos e integrações
ficam em sandbox; e-mail externo desabilitado na homologação. Novos uploads
ficam bloqueados até armazenamento persistente verificado. Não resetar banco,
sobrescrever dados ou remover recursos Render. Migrations só após verificar
o destino; restauração só com backup acessível, validado e autorizado.

Prossiga com tarefas independentes enquanto pede somente os acessos que faltam.
Ao terminar, informe URLs efetivamente publicadas, branch/SHA, testes locais
e remotos separadamente, situação dos dados antigos/uploads e bloqueios reais.
```

Preparado em 13/11/2026, com base na auditoria remota. Leia também `SORTEX_ESTADO_ATUAL.md`, `SORTEX_HISTORICO_DECISOES.md` e `SORTEX_PENDENCIAS.md`.

## Onde estão o projeto e esta documentação

- Original: https://github.com/blackwolfoficiall-glitch/SorteX
- Mac informado: `/Users/valbert/Projetos/SorteX`.
- Snapshot remoto: `main`, `2b8e8503eb33e73136cd076dbd322c78945c2ffe`.
- Branch a preservar: `infra/free-homologacao`; não encontrada no remoto, pendente conferir no Mac.
- Documentos de entrega: `/workspace/sortex-continuity/docs/`, no ambiente em nuvem desta sessão, fora de checkout Git.

Os quatro documentos ainda não estão no Mac nem no GitHub. Uma nova tarefa não deve presumir que encontrará esse caminho local. Guarde cópias dos quatro arquivos e forneça-os à nova sessão se necessário. Arquivos de uma sessão em nuvem não substituem backup durável do projeto.

## O que foi confirmado e o que não foi

Esta sessão operou como Codex com terminal em ambiente gerenciado de nuvem conectado. `/workspace` não continha o checkout da SorteX; o GitHub foi consultado pela integração. O estado observado desta sessão não comprova ambiente reutilizável da SorteX publicado para outras tarefas.

Não foi possível classificar a conversa original no Mac, acessar seu histórico, reproduzir o modo somente leitura no iPhone ou inspecionar a tarefa que informou host desconectado. O erro é compatível com dependência de host remoto, mas a causa não foi confirmada.

## Duas formas de acesso

| Forma | Onde roda | Dependência do Mac |
| --- | --- | --- |
| Remote | No computador/host selecionado | Se for o Mac, ele deve estar disponível, conectado e autorizado |
| Codex Cloud | Em ambiente gerenciado de nuvem | Pode funcionar com Mac desligado, desde que código, dados necessários e acessos estejam disponíveis na nuvem |

O iPhone funciona como interface; não recebe automaticamente os arquivos e serviços do Mac. Uma sessão local não deve ser tratada como transferível diretamente para a nuvem. Criar nova tarefa também não recupera automaticamente alterações não commitadas de outra tarefa.

## Sequência segura

1. Na sessão original com acesso ao Mac, realizar a conferência somente leitura descrita em `SORTEX_PENDENCIAS.md`.
2. Identificar a branch gratuita e todo o trabalho ainda não enviado; preservar `main`, bancos, backups, uploads e configurações.
3. Definir com o proprietário como preservar o trabalho exclusivo do Mac. Não fazer commit/push, backup por escrita ou alteração de configuração automaticamente.
4. Antes de colocar esta documentação em `docs/` do original, verificar arquivos locais equivalentes e colisões. Nunca sobrescrever. A existência remota foi conferida, a local ainda não.
5. Com autorização específica, preparar no desktop/web um ambiente Codex Cloud do repositório original. Revisar scripts de instalação e inicialização antes de executá-los: não permitir migrations, seed, deploy ou chamadas a produção automáticos.
6. Selecionar branch/commit após comparação local/remota. `main` é a referência auditada, não uma autorização de edição direta.
7. Publicar o ambiente reutilizável somente após aprovação de suas configurações; usar armazenamento de segredos apropriado, nunca chat/Git/documentos.
8. No iPhone, entrar na mesma conta e workspace, confirmar acesso a tarefas em nuvem e selecionar o ambiente preparado. Não selecionar o Mac via Remote se a intenção é trabalhar sem ele ligado.
9. Iniciar uma tarefa de leitura com o prompt abaixo, fornecer os quatro documentos e confirmar repositório, SHA, branch, acesso a dados e ausência de automações perigosas.
10. Retomar implementação apenas depois de identificar e autorizar a próxima alteração. A primeira etapa pendente é preservação local, não reconstrução.

## Limitações e diagnóstico no iOS

A disponibilidade de criação/continuação em nuvem depende da conta, plano, workspace e versão do aplicativo. Não foi verificada a interface específica do proprietário. A documentação oficial informa que a preparação/publicação do ambiente ocorre em desktop ou web; mobile usa o ambiente preparado.

Para conversa somente leitura, confirmar primeiro se é histórico de Chat, tarefa em nuvem ou sessão desktop acessada remotamente. Não apagar a conversa ou reinstalar/configurar dispositivos automaticamente. Se a tarefa continuar indisponível, registrar link/ID, horário e mensagem sem dados sensíveis e consultar suporte.

Uma nova tarefa possui espaço de trabalho separado e não garante recuperação de arquivos não commitados. O histórico da conversa e o estado da máquina são coisas distintas. A documentação oficial consultada informa janela padrão de recuperação de estado de VM de até sete dias após início de turno ou retomada; não depender dela como política de backup.

Sem acesso aos dados exclusivos do Mac, a independência completa dele ainda não está demonstrada para a SorteX.

## Fontes oficiais consultadas

- Codex Cloud, ambiente, mobile e persistência: https://help.openai.com/en/articles/20001545-using-codex-cloud
- Chat, Work, Codex e acesso remoto: https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- Conexões remotas: https://learn.chatgpt.com/docs/remote-connections

Recursos de produto podem mudar; conferir essas fontes ao preparar o ambiente.

## Prompt independente de continuidade

```text
Continue a preservação e a preparação de acesso pelo iPhone do projeto SorteX.

Repositório original:
https://github.com/blackwolfoficiall-glitch/SorteX

Projeto local informado:
/Users/valbert/Projetos/SorteX

Referência auditada em 13/11/2026:
main, commit 2b8e8503eb33e73136cd076dbd322c78945c2ffe, de 31/07/2026.
Verifique se o remoto mudou antes de usar essa referência.

Preserve main e infra/free-homologacao. Esta última não apareceu no remoto
consultado e pode existir apenas no Mac. Não a recrie nem substitua.
A branch final para desenvolver depende da comparação com o trabalho local.

Leia os quatro documentos:
SORTEX_ESTADO_ATUAL.md
SORTEX_HISTORICO_DECISOES.md
SORTEX_PENDENCIAS.md
SORTEX_GUIA_CONTINUIDADE_IPHONE.md

Eles foram criados com autorização em /workspace/sortex-continuity/docs/
no ambiente de entrega anterior, fora de um checkout Git. Ainda não foram
adicionados ao original nem enviados ao GitHub. Esse caminho pode não existir
na nova sessão. Procure em docs/ e nos anexos; se não estiverem acessíveis,
informe a ausência, sem afirmar que leu os documentos.

Antes de executar comandos, identifique ambiente, pasta e acessos. Depois
comece somente leitura, consultando AGENTS.md, status Git, branch, SHA e
remotos de forma sanitizada. Nuvem não acessa automaticamente o disco do Mac.

Arquitetura verificada: Next.js 16.2.12/React 19.2.4 em apps/web;
NestJS 11/Prisma 6 em services/api; PostgreSQL. Snapshot com 99 modelos,
107 enums e 16 migrations SQL. Não aplique migrations nem seed.

Há código de administração, organizador, comprador, campanhas, reservas,
Mercado Pago Orders sandbox, ledger, afiliados, CRM, mídia, sorteios e
integrações SMTP, Meta/WhatsApp e OpenAI. Não considere jornadas aprovadas
apenas pela existência de código ou testes. Polling e webhook podem alimentar
a confirmação de pagamento; administradores sem permissões não recebem
automaticamente acesso total. A documentação antiga tem divergências.

CI do snapshot: falhou em prisma validate; testes/builds seguintes pulados.
Há 38 arquivos de testes unitários da API e 24 arquivos Playwright, sem
aprovação atual comprovada. Não invente causa para a falha.

A configuração versionada ainda descreve Render. Hospedagem gratuita,
migração para fora da Render, serviços ativos e estado operacional da
homologação não foram comprovados. A conversa original não foi recuperada.
Preserve decisões comprovadas e registre lacunas sem inventar histórico.

Próxima etapa: conferência local do Mac — branch atual, infra/free-homologacao,
commits não enviados, alterações, stashes, arquivos ignorados, bancos,
backups e uploads. Apresente o inventário e o plano de preservação antes
de propor qualquer escrita ou envio. Não reconstrua o sistema.

A única escrita autorizada na etapa anterior foi criar os quatro documentos.
Não há autorização para commit, push, merge, deploy, configuração,
infraestrutura, contratação/reativação de serviços, exclusão, reset
destrutivo, recriação de banco, migrations ou seed. Não sobrescreva arquivos.
Não exponha credenciais, .env, tokens, dumps ou dados pessoais sensíveis.

Para funcionar sem Mac ligado, confirme um ambiente Codex Cloud preparado
com o original e acessos necessários. Não confunda isso com Remote ao Mac
nem presuma transferência automática de sessão local. Apresente a situação
verificada e solicite autorização antes de qualquer ação além de leitura.
```


## Continuidade verificada em 13/11/2026 — banco Neon preparado

Esta nota atualiza o estado operacional sem apagar a auditoria histórica acima. Consulte `docs/SORTEX_MIGRACAO_GRATUITA.md`, seção “Atualização verificada — Neon existente e pacote da API”. Branch Git: `infra/netlify-northflank-neon`, repositório original `blackwolfoficiall-glitch/SorteX`.

O projeto Neon existente `sortex-homologacao` (`crimson-bread-73821703`), branch `homologacao` (`br-lingering-voice-bc92seow`), banco novo `sortex`, Free confirmado, recebeu as 16 migrations originais. Checksums conferem e não há diferença de schema. Nenhum dado antigo, usuário ou campanha foi restaurado/criado. Mac, backups e uploads continuam pendentes de conferência; Render foi preservada.

API NestJS/Prisma/PostgreSQL preservada e empacotada para testar Neon Functions Free. Testes locais contra o Neon passaram; deploy público não concluído porque o conector rejeita o envio do ZIP antes de chegar ao serviço. Há script de upload pela API oficial, que depende de chave privada no executor seguro. Netlify ainda depende da vinculação ao GitHub no projeto existente; endereço reservado não comprova site funcional. Próxima ação solicitada: vincular o repositório à branch de migração no Netlify. Sem token no chat, cartão, cobrança ou merge em main.


### Publicação pelo celular sem chave na conversa

O workflow `.github/workflows/deploy-neon-homologacao.yml` permite publicar a API do projeto Neon existente quando o repository secret `NEON_API_KEY` for configurado com segurança no GitHub. Sem esse segredo, a publicação é pulada explicitamente. O workflow não aplica migrations, não troca a main e não cria infraestrutura paga. No primeiro deploy gera os segredos de aplicação no ambiente privado do Neon e nos seguintes os preserva. Leia a atualização “deploy automático e credencial protegida” em `docs/SORTEX_MIGRACAO_GRATUITA.md` antes de executar. A confirmação da Production branch no painel Netlify ainda precisa ser acompanhada de um deploy efetivo da branch e do commit corretos.


## Prompt atual de continuidade após publicação

```text
Continue o projeto SorteX existente, sem reconstrução. Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX. Branch Git: infra/netlify-northflank-neon. Preserve main e qualquer trabalho local infra/free-homologacao. Antes de executar comandos, confira ambiente, git status/branch/log, remoto e documentação docs/SORTEX_ESTADO_ATUAL.md, SORTEX_HISTORICO_DECISOES.md, SORTEX_PENDENCIAS.md, SORTEX_GUIA_CONTINUIDADE_IPHONE.md e SORTEX_MIGRACAO_GRATUITA.md; dê prioridade à atualização verificada mais recente.
Frontend Next.js/React: https://sortex-homologacao.netlify.app, Netlify Free, runtime oficial explicitado em netlify.toml. API NestJS/Node/Prisma: https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech, Neon Functions Free. PostgreSQL: projeto existente sortex-homologacao/crimson-bread-73821703, branch homologacao/br-lingering-voice-bc92seow, banco sortex. As 16 migrations originais foram aplicadas e verificadas, sem reset. Não reaplique nem recrie o banco. Não crie outro projeto.
O banco é NOVO. Nenhum backup/dado/upload antigo do Mac ou da Render foi restaurado. Contas técnicas foram usadas para validação; conferir sua desativação e o administrador real antes de operar. O Object Storage privado sortex-private-uploads foi validado; conferir STORAGE_DRIVER e prontidão e o teste de upload/download antes de declarar uploads ativos. API_INTERNAL_URL e API_URL da Netlify requerem redeploy quando mudam. O workflow .github/workflows/deploy-neon-homologacao.yml usa NEON_API_KEY como repository secret e preserva as chaves da aplicação nos deploys seguintes. SORTEX_ADMIN_EMAIL e SORTEX_ADMIN_PASSWORD são segredos opcionais para o comando protegido do primeiro administrador, sem promover/substituir conta existente.
Orçamento R$0, sem cartão, upgrade, cobrança ou reativação paga. Preserve NestJS, Node.js, Prisma, PostgreSQL, o frontend e todas as decisões comprovadas. Pagamentos/integracões em sandbox; não gerar cobranças reais. Não excluir arquivos/branches/dados/Render, não executar reset, force push, merge em main ou sobrescrever backups. Nunca publicar .env, senhas, tokens, CPF ou dados pessoais. Não afirmar que recuperou mensagens/arquivos inacessíveis.
Confira os links, /health/ready, branch/commit publicados e pendências da atualização mais recente. Continue pela primeira etapa ainda não validada: integração do site, uploads persistentes, administrador real ou restauração validada dos dados antigos. A sessão em nuvem e os serviços publicados podem funcionar sem o Mac ligado; arquivos exclusivos do Mac ainda precisam ser disponibilizados de forma segura.
```
