# SorteX QA: alternativa de fila protegida para d4, sem modificar main

**Minuta de preparação.** Não foi instalada no GitHub, executada ao vivo, nem acompanhada de autorização de janela. O gatilho ativo só segue se a pasta de intenções receber, em outro commit, **o único arquivo novo** `.github/qa-release-intents/d4-21-to-22.json`. Esta minuta não inclui esse arquivo. Não substituir pin pela cabeça do PR.

## Por que o fluxo e o que está separado

- `main` só contém `ci.yml`; a definição `redeploy-isolated-web-ios.yml` não está na branch padrão. O ID anterior registrado não comprova que o GitHub aceitará um `workflow_dispatch` nesse caso. Não alterar `main`, o fluxo manual existente, a branch padrão ou configurações de proteção para contornar isso. [Disparo manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
- A proposta reutiliza **separadamente** o executor d4/22 existente. O push da mudança de fluxo não abre revisão ou aplica nada. Depois de aprovar esta mudança de arquitetura e uma janela quieta concreta, uma intenção nova e só ela enfileira o job **sem segredos**. O operador aprovado é o mesmo login proprietário comprovado em metadados em 28/11/2026. A própria intenção nunca é autorização de deploy.
- O job de preflight verifica autoria, fluxo no próprio ref, um commit não forçado e sem merge, nova intenção como única mudança, os pins do manifesto da candidata, saúde do D13 e a política de Environment pública (revisor Felipe, sem bypass, branch QA única, sem tags). A autoavaliação nativa está **desmarcada** no ambiente autorizado; essa regra continua intocada. Se for alterada, o preflight para para nova decisão; não a afrouxa. Com o gate como verificado, Felipe pode iniciar e depois clicar separadamente na aprovação.
- Somente após preflight verde aparece uma revisão nativa do GitHub para o job `approved_qa` no Environment `sortex-web-ios-qa`, em **Review deployments**. O link é o run exato a ser criado; não existe agora. [Revisão de deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments).
- Após o clique explícito, o job revalida a janela e a política. Compila do SHA d4 sem segredos, e somente sua última etapa lê os segredos QA já configurados. Primeiro roda a prova base e o ledger em modo leitura, depois, ainda na janela, pode iniciar a única migração aditiva #22, confirmar o D13 lendo o novo schema e avançar uma vez para d4. Há checagem de tempo também antes da primeira alteração e antes de promover o binário. O job usa a fila existente do QA, não promove novamente por reexecução e não usa bootstrap.
- A API está fixa em `d4e499e29c76a11f4275c2be8d34e6a4a616cb70`. A cabeça `e40e58500cc58ff234b1ba38fc380b09c92e9a03` já inclui as mudanças da cabeça anterior 802f3df, inclusive migração #23 para quota de IA. A revisão de lançamento **não inclui #23**, flags, produção, alteração do Site v8, dados reais ou pagamentos. Continua válido o [procedimento de rollback e revisão para campanhas Brasília](PRONTIDAO_MIGRACAO_JANELA_VENDAS_QA.md).

## Intenção operacional futura (não criar antes da autorização)

O arquivo conteria somente os seis campos abaixo, sendo os dois horários escolhidos pelo usuário em UTC, com janela de 10 a 45 minutos (recomendada 25–40). Exige início já alcançado e tempo suficiente para a operação. Uma janela que ainda não foi entregue pelo fundador **impede enfileirar a revisão**, não impede preparar o código localmente. Não escolher horário por ele. Não fazer novo push do arquivo já criado, merge com outras mudanças, force push ou reenviar execução; em resultado duvidoso primeiro reconciliar somente por leitura.

- `candidate`: `d4e499e29c76a11f4275c2be8d34e6a4a616cb70`.
- `base`: `48eeb85830c2dddab048796d7859200e65cc73f9`.
- `deployment`: número `13`.
- `migration`: `20261126230000_explicit_campaign_draw_timezone`.
- `windowStartUtc` e `windowEndUtc`: ISO UTC com segundos e `.000Z`.

Sem prova do ledger ou convergência do novo deployment, suspender a avaliação e não repetir. Manter coluna nullable se a migração já terminou, reconciliar D13/d4 por saúde/readiness/catálogo, manter Site privado e não restaurar comportamento do D13 para novas compras com horário Brasília sem uma decisão e uma janela novas.
