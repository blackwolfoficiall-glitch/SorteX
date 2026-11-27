# Executor manual QA: minuta offline, não habilitada

Esta minuta está fora de `.github/workflows`. Não foi instalada, disparada ou usada para tocar no Neon, na prévia ou na produção. Os testes deste diretório executam apenas localmente, com respostas sintéticas para metadados do GitHub.

## Bloqueio real

O [GitHub exige o arquivo do fluxo na branch padrão para aceitar `workflow_dispatch`](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Na inspeção somente leitura, `HEAD` remoto aponta para `main` em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`. Ela contém somente `.github/workflows/ci.yml`, com `pull_request` e `push` na `main`, sem disparo manual. Os fluxos de bootstrap e atualização existentes apenas na branch candidata não atendem a esta condição. Usar CLI/API, reutilização ou um push não substitui uma entrada manual protegida aprovada. Não alterar a `main`, não alterar o gatilho existente e não aproveitar uma versão anterior do fluxo.

Se outra arquitetura de execução for avaliada, ela deve ser tratada como uma decisão separada, especificamente autorizada e revisada, sem usar um push como substituto para uma ação manual. Nenhuma alternativa está instalada aqui.

## Controles da minuta

- Único evento `workflow_dispatch`; somente a primeira tentativa, repositório exato, branch `homologacao/web-ios-integrada` e workflow esperado. Nada ocorre por push ou PR.
- O modo padrão é **plan**. Na operação futura real, o plano consulta o estado da função e o histórico de migrações que o portão espera, mas não executa Prisma nem promove código. Usa o mesmo executor e bloqueio de concorrência do bootstrap.
- **apply** requer o ID de outro run de plano da mesma pessoa, revisão, workflow, repositório e branch. A verificação é repetida após a aprovação do ambiente e o build, imediatamente antes da etapa protegida. Exige conclusão bem-sucedida na primeira tentativa em até 30 minutos, pelas [rotas oficiais de runs](https://docs.github.com/en/rest/actions/workflow-runs) e [jobs por tentativa](https://docs.github.com/en/rest/actions/workflow-jobs). O operador também atesta que ninguém está testando a prévia e fornece a frase não secreta exata do portão existente. Não significa aprovação de uma janela atual; sem janela tranquila, não prossiga.
- O job de autorização não usa credenciais de QA. O token GitHub temporário é usado apenas nas duas consultas GET de recibo para **apply**, com permissões de leitura, em etapas sem os segredos QA. A execução real exige o ambiente existente `sortex-web-ios-qa`, com proteções de branch/revisores a serem verificadas como precondição operacional. Nenhuma proteção do ambiente foi alterada ou testada pelo rascunho.
- O checkout operacional usa o SHA do run e histórico suficiente para o teste de ancestralidade, e o checkout de código usa a revisão testada `09a0f9ac2d18d3369c464cfa7fec8a8b5f6745be`. Nenhum checkout persiste credenciais. O build parte de uma árvore limpa, sem segredos QA, com ambiente mínimo e URL fictícia de loopback.
- Somente a etapa final recebe os dois segredos QA, por variáveis de ambiente. Ela executa o portão existente, que valida o deployment-base 13, SHA `48eeb85830c2dddab048796d7859200e65cc73f9`, storage privado e os manifests das migrações 21→22. Sem logs brutos, retry automático, alvos fornecidos pelo operador ou mudança de configuração. Se um estado já tiver mudado, reconcilie primeiro em vez de repetir.

A ativação, se vier a ser autorizada, requer nova revisão do desenho com uma entrada manual suportada pelo GitHub; `authorize.cjs` espera exatamente o caminho `.github/workflows/release-draw-window-qa.yml` e o ref QA. A aprovação desta minuta, por si só, não instala esse caminho nem autoriza executar qualquer modo. A prova CI existente e o procedimento do portão estão em [Execução manual e migração](../EXECUCAO_MANUAL_MIGRACAO_JANELA_QA.md).

## Validação offline

A partir da raiz do repositório, com Node 24, Bash e PyYAML disponíveis:

```sh
d=docs/homologacao-2026-11-25/executor-manual-qa
node --test "$d/authorize.test.cjs"
python3 "$d/verify_workflow.py"
```

Os testes validam a configuração YAML, o shell, as expressões de escopo e de segredos, a pinagem e as recusas do verificador de recibo. A preparação é local; não comprova que o GitHub aceita um futuro despacho nem que o Neon hospedado foi atualizado.
