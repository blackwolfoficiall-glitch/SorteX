# Prontidão da API e ensaio de migração da janela de vendas

## Resultado em banco descartável

Em 26/11/2026 (Bahia), três processos Nest foram compilados ou conferidos pelo código-fonte exato e executados em loopback com PostgreSQL 18 descartável: API anterior `48eeb85830c2dddab048796d7859200e65cc73f9`, candidata anterior ao guard `80927f332acfdc2d0d1ff9140294341fb5187fb1` e a candidata corrigida em `5b144e7ad50cf47a111287a7949816eace260bd6`. As credenciais e campanhas foram sintéticas. Sem provedor, pagamentos, deploy ou acesso ao banco hospedado.

| Estado comprovado | API anterior | Candidata sem guard | Candidata corrigida |
| --- | --- | --- | --- |
| Schema anterior, 21 migrações e tabela `Campaign` vazia | `/health/ready` 200 | `/health/ready` 200, mas `/public/campaigns` 503 | `/health/ready` 503 genérico e `/health/live` 200 |
| Após aplicar somente a 22ª migração | Prontidão 200; mesma campanha legada, resposta HTTP idêntica | Não necessária neste passo | Prontidão 200 e leitura da mesma campanha legada, com instante preservado |
| Nova campanha sintética marcada `America/Sao_Paulo`, às 12h de Brasília antes do sorteio de 20h | Leitura HTTP 200, nova reserva 400 por cutoff antigo | Não necessária neste passo | Leitura 200, janela `OPEN` até 23h UTC e reserva 201 |

As 21 migrações originais tinham nome e SHA-256 iguais aos arquivos das duas revisões, sem migração incompleta ou revertida. A única adição, `20261126230000_explicit_campaign_draw_timezone`, tem SHA-256 `2192bdf90202d7ab60e7d92ccdc0e474fa900a4b6914c77fa4f4e8a102cb6618`. Após `prisma migrate deploy`, os 22 registros corresponderam aos arquivos; a coluna era PostgreSQL `text`, anulável, sem default, e o registro antigo permaneceu intacto (incluindo `updatedAt` e o marcador nulo). Repetir a tentativa já reservada retornou o mesmo ID nos dois binários: uma reserva sintética, zero pagamentos.

## Portão para uma futura janela autorizada, somente no QA

1. Confirmar janela sem prévia/teste em andamento. Fixar o SHA aprovado, identificador do deploy-base (13 somente se ainda estiver ativo) e a origem `sortexqa` do projeto e branch isolados. Verificar ambiente protegido `sortex-web-ios-qa`, destino exclusivamente direto no `neondb`, storage privado, configuração preservada e ausência de pagamentos reais. Não copiar banco ou credenciais para outro ambiente.
2. Em consulta somente leitura, guardar a lista e SHA-256 das 21 migrações completas e conferir que apenas a adição acima está pendente no SHA fixado. Parar se houver divergência, indício de migração incerta ou lock incompatível com a janela. A DDL é aditiva, mas exige lock de tabela. O script existente `services/api/scripts/migrate-isolated-qa.cjs` valida o destino e chama o Prisma; seu `--status` não substitui a conferência dos checksums e pode retornar falha quando há uma migração pendente. Não repetir gravação após resultado ambíguo. Não usar o bootstrap de primeiro deploy.
3. Aplicar apenas a adição esperada e conferir imediatamente os 22 checksums, zero migrações incompletas ou revertidas, coluna anulável sem default, saúde e leitura de campanha na API anterior. Só então o atualizador **de código** pode avançar o binário com o SHA e o deploy-base exatos. Antes de disponibilizar a próxima prévia, verificar SHA ativo e estável, `/health/ready` com banco e storage, leitura HTTP e exercício sintético de fechamento de vendas, sem depender de `/health` sozinho.
4. Se a troca de binário falhar, manter a coluna aditiva. Voltar ao binário antigo permite ler a base, mas **não é rollback comportamental**: uma nova campanha com marcador Brasília volta a fechar antes da hora. Se houver registros marcados, não reabrir a prévia nem novas reservas para essas campanhas com o binário anterior; preferir correção adiante e verificar a janela de cada caso afetado. Não descartar a coluna nem reescrever os registros para forçar rollback. Nenhum fluxo de deploy ou migração hospedada é acionado por este documento.
