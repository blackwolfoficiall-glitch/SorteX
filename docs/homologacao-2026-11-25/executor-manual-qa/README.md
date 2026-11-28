# Executor manual QA: referência e critérios de liberação

Este arquivo é a referência revisada da rota manual exclusiva QA. A mesma definição deve estar em `.github/workflows/redeploy-isolated-web-ios.yml`, registrada anteriormente por execuções QA. Nenhum teste deste diretório toca o Neon, a prévia ou a produção; as respostas de metadados GitHub são sintéticas.

## Restrição da branch padrão

[O GitHub pode não oferecer o botão de despacho manual quando a definição não existe na branch padrão](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch). A mesma referência documenta a opção por CLI/API autenticada para fluxo que já executou. A rota .github/workflows/redeploy-isolated-web-ios.yml já teve execuções na branch QA. Isso não comprova que um despacho futuro será aceito: valide primeiro somente o modo `plan` no ref QA já registrado. Se o GitHub recusar, pare e mantenha os ambientes inalterados; não mude `main` ou a branch padrão, nem use push ou reexecução como substituto.

## Controles da minuta

- Único evento `workflow_dispatch`; somente a primeira tentativa, repositório exato, branch `homologacao/web-ios-integrada` e workflow esperado. Nada ocorre por push ou PR.
- O modo padrão é **plan**. Na operação futura real, o plano consulta o estado da função e o histórico de migrações que o portão espera, mas não executa Prisma nem promove código. Usa o mesmo executor e bloqueio de concorrência do bootstrap.
- **apply** requer o ID de outro run de plano da mesma pessoa, revisão, workflow, repositório e branch. A verificação é repetida após a aprovação do ambiente e o build, imediatamente antes da etapa protegida. Exige conclusão bem-sucedida na primeira tentativa em até 30 minutos, pelas [rotas oficiais de runs](https://docs.github.com/en/rest/actions/workflow-runs) e [jobs por tentativa](https://docs.github.com/en/rest/actions/workflow-jobs). O operador também atesta que ninguém está testando a prévia e fornece a frase não secreta exata do portão existente. Não significa aprovação de uma janela atual; sem janela tranquila, não prossiga.
- O job de autorização não usa credenciais de QA. O token GitHub temporário é usado apenas nas duas consultas GET de recibo para **apply**, com permissões de leitura, em etapas sem os segredos QA. A execução real exige o ambiente existente `sortex-web-ios-qa`, com proteções de branch/revisores a serem verificadas como precondição operacional. Nenhuma proteção do ambiente foi alterada ou testada pelo rascunho.
- O checkout operacional usa o SHA do run e histórico suficiente para o teste de ancestralidade, e o checkout de código usa a revisão testada `d4e499e29c76a11f4275c2be8d34e6a4a616cb70`. Nenhum checkout persiste credenciais. O build parte de uma árvore limpa, sem segredos QA, com ambiente mínimo e URL fictícia de loopback.
- Somente a etapa final recebe os dois segredos QA, por variáveis de ambiente. Ela executa o portão existente, que valida o deployment-base 13, SHA `48eeb85830c2dddab048796d7859200e65cc73f9`, storage privado e os manifests das migrações 21→22. Sem logs brutos, retry automático, alvos fornecidos pelo operador ou mudança de configuração. Se um estado já tiver mudado, reconcilie primeiro em vez de repetir.

Para executar, confirme primeiro o apoio a despacho manual no ref QA existente e a janela autorizada; `authorize.cjs` espera exatamente o caminho `.github/workflows/redeploy-isolated-web-ios.yml` e o ref QA. Uma revisão do código, por si só, não dispara nem autoriza aplicar. A prova CI existente e o procedimento do portão estão em [Execução manual e migração](../EXECUCAO_MANUAL_MIGRACAO_JANELA_QA.md).

## Validação offline

A partir da raiz do repositório, com Node 24, Bash e PyYAML disponíveis:

```sh
d=docs/homologacao-2026-11-25/executor-manual-qa
node --test "$d/authorize.test.cjs"
python3 "$d/verify_workflow.py"
```

Os testes validam a configuração YAML, o shell, as expressões de escopo e de segredos, a pinagem e as recusas do verificador de recibo. A preparação é local; não comprova que o GitHub aceita um futuro despacho nem que o Neon hospedado foi atualizado.
