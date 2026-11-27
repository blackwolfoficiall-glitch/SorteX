# Prêmio por meta: extração após a fotografia de elegibilidade

A meta só pode ser apurada quando está liberada, contém títulos na fotografia
e tem a data dessa fotografia registrada. A referência é o instante mais
recente entre `snapshotAt` e a data da meta, se houver. Uma data programada
futura bloqueia a apuração mesmo que já exista uma extração cadastrada.

A primeira extração da Loteria Federal (provedor `LOTERIA_FEDERAL`) com
estado `VERIFIED` ou `LOCKED` precisa ser de um **dia posterior** à referência
no fuso de Brasília. Cadastros de outros provedores não entram na seleção. A importação oficial da CAIXA preserva
`dataApuracao` como dia civil a 00:00 UTC, não como horário da extração. Essa
interpretação é utilizada somente para resultados marcados como importação
oficial com os prêmios originais e o hash da resposta registrados. O horário
livre e o momento da revisão não comprovam a ordem entre eventos do mesmo dia.

O cadastro manual aceita tanto uma data ISO sem hora quanto um timestamp ISO;
o banco não distingue essas duas representações quando ambas viram meia-noite
UTC. Nos resultados manuais, importados ou de documento, o valor armazenado
precisa alcançar o início do próximo dia em Brasília. Se for ambíguo na
fronteira, aguarde uma extração elegível em vez de inferir a precisão. Registros
com dia futuro não entram na seleção. Não há migração, edição de extrações
existentes, reconstrução da fotografia nem mudança na regra publicada, na
forma de escolher o título elegível ou na apuração do prêmio principal.

A regressão HTTP usa somente PostgreSQL em loopback, descartável, e registros
sintéticos. O comando exige o banco vazio migrado `sortex_milestone_test_*`:

```sh
SORTEX_MILESTONE_DRAW_E2E_DATABASE_URL='<conexão descartável em loopback>' \
  npm run test:e2e -- --runInBand milestone-extraction-postgres.e2e-spec.ts
```

O cenário congela pelo endpoint real um título pago e vendido, rejeita
extrações arquivadas e do mesmo dia, e verifica aceitação da próxima extração
verificada/bloqueada com a mesma fotografia. Também confere a ausência de
pagamentos no banco de teste; não consulta o provedor ou a CAIXA.

A rotina de homologação do GitHub roda essa regressão no banco descartável
`sortex_milestone_test_ci` do serviço PostgreSQL do próprio runner. A suíte
não recebe segredos ou dependências de homologação hospedada.
