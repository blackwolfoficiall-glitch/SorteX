# SorteX — pendências e próxima etapa

> Registro da auditoria anterior, preservado. Este arquivo foi incorporado ao checkout da branch `infra/netlify-northflank-neon`; as afirmações abaixo sobre ausência de checkout e autorização somente documental descrevem aquela etapa. Para a migração autorizada depois, consulte `SORTEX_MIGRACAO_GRATUITA.md`. Nenhum estado do Mac foi conferido nesta sessão.

Auditoria: 13/11/2026. Base remota: `blackwolfoficiall-glitch/SorteX`, `main`, `2b8e8503eb33e73136cd076dbd322c78945c2ffe`.

Este arquivo faz parte da entrega em `/workspace/sortex-continuity/docs/`, fora do repositório original. Nenhuma pendência foi corrigida durante a auditoria. A ordem abaixo é recomendada para preservação; não é uma lista recuperada de prioridades aprovadas anteriormente.

## P0 — comprovar preservação no Mac

- [ ] Confirmar que `/Users/valbert/Projetos/SorteX` é o checkout original e sanitizar a identificação dos remotos antes de compartilhá-la.
- [ ] Registrar branch ativa, HEAD e branches locais/remotas.
- [ ] Localizar `infra/free-homologacao` e registrar seu SHA, upstream e diferenças; não recriar nem apagar.
- [ ] Inventariar commits não enviados e alterações staged/unstaged sem descartar nada.
- [ ] Inventariar arquivos não rastreados, ignorados e stashes.
- [ ] Identificar bancos locais, volumes Docker, uploads, dumps, backups e configurações fora do Git; registrar apenas localização e necessidade de preservação, sem conteúdo sensível.
- [ ] Verificar existência local dos quatro documentos ou equivalentes antes de copiar a entrega.
- [ ] Propor preservação verificável dos itens exclusivos do Mac, separando código de dados/segredos; solicitar autorização antes de escrever backups ou enviar arquivos.

O `.gitignore` remoto exclui `.env`, backups, armazenamento e dumps, entre outros. Portanto, a cópia GitHub sozinha não garante preservação integral.

Comandos de leitura para executar apenas na sessão com acesso ao Mac:

```bash
GIT_OPTIONAL_LOCKS=0 git -C /Users/valbert/Projetos/SorteX status --short --branch
git -C /Users/valbert/Projetos/SorteX branch -vv
git -C /Users/valbert/Projetos/SorteX log --oneline --decorate -20
git -C /Users/valbert/Projetos/SorteX ls-files --others --exclude-standard
git -C /Users/valbert/Projetos/SorteX ls-files --others --ignored --exclude-standard
git -C /Users/valbert/Projetos/SorteX stash list
```

As referências de upstream podem estar desatualizadas; não executar fetch/pull automaticamente nesta fase. Não compartilhar logs, conteúdo de configuração ou nomes sensíveis sem revisão.

## P1 — estabelecer a base técnica validada

- [ ] Diagnosticar a falha de `prisma validate` na CI 30623693093; a causa ainda não foi confirmada.
- [ ] Conferir histórico das 16 migrations contra schema e bancos relevantes em leitura. Não aplicar migrations nem criar banco automaticamente.
- [ ] Preparar proposta de validação isolada, após inventariar scripts e possíveis efeitos colaterais.
- [ ] Verificar lint, tipos, testes e builds apenas no ambiente autorizado; resultados antigos não substituem execução atual.
- [ ] Validar backup e possibilidade de restauração antes de qualquer mudança de banco, sob autorização específica.

Evidência CI: https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/30623693093
Falha em `prisma validate`; testes e builds posteriores pulados. Não afirmar que a suíte atual passou.

## P1 — documentação e decisões

- [ ] Complementar os relatórios com a conferência local.
- [ ] Recuperar, se fornecida, a conversa original e decisões sobre Render/hospedagem gratuita.
- [ ] Comparar documentação antiga de polling, permissões, migrations e integrações com o código atual.
- [ ] Conferir a regra de consumo da primeira campanha gratuita contra o requisito de registro permanente.
- [ ] Preservar os documentos anteriores; propor atualizações explícitas em vez de substituí-los automaticamente.

## P2 — administração e organizador

- [ ] Validar matriz de SUPERADMIN, ADMIN, analista, financeiro, suporte e auditoria, inclusive negações e acesso direto à API.
- [ ] Validar equipe/convites, documentos, aprovação de organizador e condições comerciais.
- [ ] Validar moderação de campanhas com vendas, preservação de regras publicadas e trilhas de auditoria.
- [ ] Validar listagens, filtros, detalhes, financeiro, suporte, conteúdo e saúde no navegador.
- [ ] Validar fluxos do organizador: campanhas, pedidos, personalização, minicampanhas, planos de teste e limites por recurso.
- [ ] Definir a evolução da verificação DNS; o fluxo atual não comprova domínio ativo.

## P2 — pagamentos, comissões e apuração

- [ ] Validar PIX/cartão sandbox de ponta a ponta, reservas concorrentes, expiração e divergências.
- [ ] Validar confirmação via webhook e polling, duplicidade e concorrência entre ambos.
- [ ] Confirmar assinatura, relógio e eventos Orders no ambiente correto, sem divulgar payloads sensíveis.
- [ ] Conciliar compra, títulos, pagamento, ledger, comissão e reversões no ambiente isolado.
- [ ] Validar saldo/repasse administrativo distinguindo registros internos de dinheiro efetivamente transferido.
- [ ] Validar regras versionadas, número não vendido, consulta de ganhador, confirmação e transparência pública da apuração.
- [ ] Manter produção financeira, pagamentos de prêmios e saídas de dinheiro sem ativação automática.

## P2 — integrações, segurança e operação

- [ ] Inventariar somente presença e escopo de configuração de SMTP, Mercado Pago, Meta/WhatsApp e OpenAI, sem extrair segredos.
- [ ] Revisar o log de link de recuperação em desenvolvimento; logs podem conter token de recuperação.
- [ ] Confirmar flags e todos os pontos de uso antes de alegar que uma integração está bloqueada.
- [ ] Validar uploads, permissões, privacidade, CORS/cookies e exposição de dados no domínio final.
- [ ] Avaliar coordenação de cache/jobs/rate limit entre instâncias, antivírus e observabilidade externa.
- [ ] Revalidar dependências; os relatos antigos de vulnerabilidades/lint não foram reproduzidos.
- [ ] Testar acessibilidade e Safari/iOS real. O perfil iPhone do Playwright atual usa Chromium.
- [ ] Manter revisão jurídica/financeira como pendência; código jurídico não comprova aprovação.

## P1 — continuidade no iPhone

- [ ] Conferir se o projeto depende de banco, arquivos, serviços ou credenciais exclusivos do Mac.
- [ ] Escolher branch/commit de continuidade após comparar o trabalho local; não presumir `main` como base final de desenvolvimento.
- [ ] Preservar os documentos fora do estado temporário da sessão e transferi-los ao destino original somente após verificar conflitos.
- [ ] Preparar ambiente Codex Cloud reutilizável com o repositório original, sem publicar credenciais e sem scripts automáticos de migration/deploy.
- [ ] Confirmar elegibilidade e permissões da conta/workspace, publicar configuração somente com autorização e testar uma tarefa de leitura no iPhone.

## Infraestrutura: informações ainda ausentes

O remoto contém Render e Compose. Não foram confirmados serviços ativos, domínio atual, custos, migração de dados para outro provedor nem hospedagem gratuita. Localizar a branch `infra/free-homologacao` é essencial antes de propor infraestrutura substituta.

## Critério para retomar desenvolvimento

Repositório e branch locais identificados; alterações exclusivas inventariadas e com plano de preservação aprovado; documentação acessível à nova sessão; ambiente de execução confirmado; próxima alteração escolhida com evidências. A autorização para criar documentação não autoriza implementar essas pendências, fazer commit/push ou modificar serviços.
