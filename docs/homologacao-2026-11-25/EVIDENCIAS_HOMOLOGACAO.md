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

### Reexecução na integração

- Protocolo HTTP local executado às 15:46:08 UTC no SHA `86bc012` com 20 migrações. Rascunho web `cmwwapwc20013pe4yc0l60lra`; rascunho criado pelo cliente móvel `cmwwapx6d0015pe4ygafzr469`. Mesmo ID, papel e perfil em ambos os sentidos; renovação emitindo um novo token; outro organizador sem acesso de escrita.
- Chromium: 93/93 na suíte completa do trabalho web com HTTPS local, Nest e PostgreSQL 18.7. Novo teste focado da capa passou ao confirmar HTTP 200 e imagem renderizada. WebKit com viewport de iPhone 13: 32/32 na mesma trilha web, incluindo a capa e os casos de cadastro.
- Integração recente: 305/305 testes unitários da API; 25/25 testes móveis; TypeScript e bundle Metro iOS com a reserva ativada. Bundle, navegador e cliente HTTP não são compilação/instalação de iPhone físico.

## 26/11/2026 · leitura real da fonte Federal e minimização da prova

- **Fonte oficial, somente leitura:** o [endpoint Federal da CAIXA](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal) devolveu a extração 6120 de 25/11/2026. O parser da candidata leu os 2.779 bytes (SHA-256 `35c3e58f314e6355926caa41467459d6489adedf40844e9de45f35330c251830`), preservou cinco valores de seis caracteres e extraiu cinco valores válidos de cinco caracteres para o motor. Nenhum resultado real foi gravado ou usado para apurar campanhas.
- **Prova sintética HTTP/PG:** comprovados replay, bloqueio de divergência, resultado `00091`, remoção de notas/identificadores internos da resposta pública e retirada do selo após invalidação. A resposta mantém a extração, os valores, a regra, o resultado e os hashes públicos; URLs da fonte que não forem o endpoint oficial verificado não são expostas. Os registros internos permanecem intactos.
- **Limites:** a importação oficial permanece desabilitada no QA hospedado; esta leitura não homologa o importador em produção, o app no iPhone nem pagamento, título e saldo gerados pelo Mercado Pago Teste.
- **Paridade Federal do cenário 6:** para a mesma campanha sintética em PostgreSQL descartável, a extração 6091 usou `000091` da fixture histórica como `00091` canônico. Nest executou e confirmou a regra v1 reversa e encontrou `19000`. O cliente HTTP do app e o BFF Next leram a mesma prova (extração, regra, resultado, hash e status); o Chromium mostrou a página Next. O app passou no typecheck e gerou bundle iOS; a interface ainda não foi exercitada em iPhone físico. Sem chamadas financeiras neste teste.

## 26/11/2026 · taxa da primeira campanha e saldo interno

- **Primeira criada, sem rascunho anterior:** compra local de R$ 30,50. SorteX R$ 0,00, tarifa estimada de gateway R$ 0,38 (fixture 1,25%), crédito líquido pendente único de R$ 30,12 e saldo disponível de R$ 0,00.
- **Primeira publicada com rascunho mais antigo:** mesmo valor e tarifa estimada; a regra atual cobra R$ 0,88 da SorteX, deixa R$ 29,24 pendentes e R$ 0,00 disponíveis. O rascunho é contado pela data de criação. A regra comercial não foi alterada.
- Reserva autenticada, Pix via cliente substituído, callback assinado sintético, reentrega e extrato HTTP exercitados em PostgreSQL descartável (5 testes da suíte de pagamentos). Nenhuma chamada ao provedor, liquidação, repasse externo ou cenário financeiro físico aprovado.
