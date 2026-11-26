# Ativação auditável do storage privado da QA

A prova [45845492623](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45845492623)
gravou e releu um PNG sintético de 69 bytes com credenciais nativas da Function
isolada e confirmou a recusa anônima. A prova não ativou uploads na API, nem
homologou os fluxos de mídia do site/iPhone.

## Antes de executar

- O workflow `sortex-qa-activate-storage.yml` é **somente reutilizável**. Não
  contém gatilho automático nem existe caller neste patch. Após revisar a
  correção de autorização Web e seu CI, o caller revisado deve fixar o SHA
  completo do código que contém a correção e o ID da execução bem-sucedida
  de `homologacao-web-ios.yml` no push da branch QA. Fixar também o SHA
  completo servido pela API e o ID do deployment atual/ativo comprovados
  após qualquer publicação de código necessária. Usar `confirm-bucket:
  sortex-qa-media` como confirmação explícita. Não aceitar pinos flutuantes.
- Caller restrito a uma primeira tentativa deliberada da ref
  `homologacao/web-ios-integrada`; usar controle de concorrência compartilhado
  no workflow chamado, não duplicá-lo no caller. Usar permissões apenas
  `contents: read`, `actions: read`. Não usar token pessoal nem novo secret:
  o ambiente `sortex-web-ios-qa` fornece a chave Neon existente do projeto,
  exclusivamente para a etapa de configuração. Evitar operações de painel
  concorrentes; esta API de publicação não oferece uma confirmação atômica
  da versão base nesta implementação.
- A linha de base deve servir a revisão esperada com banco `up`, storage
  `disabled` e sem `STORAGE_DRIVER` ou `STORAGE_BUCKET` definidos. Se alguma
  dessas chaves já existir, não inferir valores nem tentar este procedimento.

## Resultado esperado

A única solicitação de ativação envia um multipart `environment`:
`STORAGE_DRIVER=neon-s3`, `STORAGE_BUCKET=sortex-qa-media`,
`UPLOADS_DISABLED=false`. A ausência de ZIP preserva o pacote; nenhum
projeto/bucket/arquivo/chave é criado, reutilizado fora da QA ou apagado,
e não há migração ou configuração do gateway. Verificar que só os dois
nomes novos entraram nos metadados, `/health` mantém o mesmo SHA e
`/health/ready` confirma banco e storage `up` (HeadBucket). Em seguida,
rodar as provas de upload/acesso privado e da Web separadamente: o
HeadBucket não prova o upload pelo middleware nem as permissões da aplicação.

Após três respostas seguidas objetivamente incompatíveis do app na mesma
revisão, o script pode reverter apenas as três flags: volta
`UPLOADS_DISABLED=true` e remove os overrides criados de driver/bucket.
Antes de reverter, exige que o deployment da ativação ainda seja atual e
ativo, terminado e com os mesmos nomes. Timeouts, HTTP de gateway,
recibo ausente, estado substituído e alterações de ambiente não autorizam
um segundo POST; inspecionar os recibos e estado atual no painel QA antes
de qualquer ação manual. Inclui o caso em que o provedor talvez tenha
aceitado a solicitação sem retornar o recibo.

O redeploy apenas de código existente espera `storage:disabled`.
Não rerodá-lo após a ativação antes de uma revisão específica. A função
de smoke permanece intocada e seu token efêmero não é reutilizado.

Referências: [deploy só de configuração](https://neon.com/docs/compute/functions/deploy#deploy-with-the-api),
[semântica de merge/remoção dos overrides](https://neon.com/docs/compute/functions/environment-variables),
[evidência pelo GitHub Actions](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run).

## Evidências de 26/11/2026

- A atualização de código preservou os uploads desativados no [deploy 6](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45847861349).
- A primeira chamada com workflow reutilizável não recebeu o segredo do ambiente e parou antes de chamar o Neon. A chamada direta obteve o deploy 7 e fez o [rollback das três flags para o deploy 8](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45848884023) após as leituras iniciais de prontidão.
- O [deploy 9 confirmou a ativação](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45849233750). A primeira instância ainda respondeu `disabled`; aguardamos duas leituras consecutivas `up`. O teste HTTP seguinte confirmou capa sintética no BFF e no backend, mesmos bytes, sem cache, e negação a anônimo e outra organização. Nenhum rascunho foi publicado.
- O gatilho pontual foi retirado. Não execute novamente o publicador antigo que presume `storage: disabled`; a ativação não trocou credenciais, habilitou pagamentos ou alterou produção. Ainda não há evidência de restauração, uploads de documentos na nuvem ou aceite físico.
