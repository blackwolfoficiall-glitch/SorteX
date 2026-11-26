# SorteX: nova auditoria funcional Web/iOS

Base inspecionada: PR #1, `cc66e241a24f8c26c277b48f0759b7ad266e0747`.
A tabela considera caminhos de entrada reais em `apps/mobile/App.tsx`, contratos
em `apps/mobile/src`, páginas do Next e rotas Nest. A presença de código nunca
significa aceite no aparelho. A API publicada e a disponibilidade do Mac são
verificadas à parte. **Nenhum dos nove cenários físicos foi executado nesta
reauditoria.** A nova consulta nativa de prêmios está indicada separadamente.

**Legenda.** N = tela React Native alcançável; L = evidência local HTTP/PG, teste
automatizado ou build, como descrito na linha; W = recurso localizado apenas no
site; NE = implementação nativa não encontrada. Abrir um site ou link não é
paridade nativa. O checkout de teste não equivale a pagamento liquidado.

**Base de medição desta revisão:** 18 jornadas aplicáveis do quadro, sem contar administração (restrição intencional). Em 12/18 (67%) há entrada nativa ao menos parcial, condicional ou de leitura; em 6/18 (33%) não foi localizado caminho nativo para a operação descrita. Nenhuma das 18 foi aceita de ponta a ponta como paridade integral. Essa medida de cobertura não é o aceite físico dos nove cenários (0/9).

| Funcionalidade | Site | Aplicativo iOS nesta revisão | Evidência/limite verificável |
|---|---|---|---|
| Login e sessão de comprador/organizador | /login, sessões por cookies | **N parcial:** senha, troca de sessão e SecureStore. Admin não entra no aplicativo. | Cliente e BFF: `test-web-ios-parity.ts`, testes de sessão; reinstalação e troca de conta no iPhone pendentes. |
| Cadastro, recuperação, Apple/Google | Cadastro por papel, esqueci/recuperar senha; rotas de login social | **N parcial:** cadastro CPF/PF/PJ com aviso legal e fluxo de recuperação. Apple/Google indisponíveis nesta candidata. | O broker social e a abertura do e-mail/deep link no iPhone não estão homologados. |
| Criação de campanha | Editor e wizard completos | **N parcial:** cria rascunho com título, resumo, descrição, nome do prêmio, quantidade e preço. | L: criação bidirecional e o mesmo ID pelo HTTP (`test-web-ios-parity.ts`). Publicação nativa ausente. |
| Edição e gestão da campanha | Editor, publicação, pausa e encerramento | **N parcial:** lista, consulta, rascunho editável; publica/pausa/encerra somente pelo site nesta candidata. Em publicada/pausada edita título, resumo e descrição sem reenviar preço/cotas. | L: `test-published-campaign-parity.ts` preserva ID, isolamento, campos protegidos e recusa após encerramento. |
| Prêmio principal, imagens e troca de capa | Editor e upload; capa pública no detalhe/card | **N parcial:** nome do prêmio no rascunho, exibe capa pública no detalhe do comprador. Sem upload/troca nativa de foto ou editor avançado de prêmio. | L: mesma imagem/troca por upload web, bytes e isolamento (`test-published-campaign-parity.ts`); não prova upload/iOS. |
| Cotas premiadas, prêmios por meta e roleta | Editor e superfície de campanha pública | **NE** para configurar, executar ou gerir essas modalidades. Consulta pessoal de cota premiada na mudança desta rodada (linha abaixo); não inclui roleta/prêmio por meta. | Testes web e contratos de prêmios por meta/roleta não equivalem a testar no app. |
| Promoções/cupons | Editor de promoções e campanha web | **NE** para criar, gerir ou confirmar desconto no app nesta revisão. | Rotas de promoções/checkout na API não representam interface nativa. |
| Campanhas para o comprador | Lista/detalhe público | **N parcial:** catálogo, detalhe, capa canônica sem credenciais, regulamento. | L: BFF e cliente HTTP veem campanha publicada; capa tem teste de bytes/visibilidade. Não prova decodificação no iPhone. |
| Seleção/reserva e checkout | Seleção, reserva e checkout web | **N condicional:** cotas por reserva manual/aleatória e PIX dependem de flags sandbox; Core é consulta. | L: `test-buyer-reservation-local.ts` e integração com provedor controlado. Provedor real de Teste, confirmação assinada e iPhone pendentes. |
| Pedidos, títulos e histórico | Pedidos e meus títulos | **N parcial:** lista e detalhe, títulos e estado de pagamento lidos da API. | Leitura/conciliação local não comprova PIX. Não prometer emissão/entrega por status visual. |
| Resultados e prova de ganhador | Resultado e prova pública pelo código | **N parcial:** Resultados e consulta da prova com hash e zeros à esquerda. | L: `test-public-draw-parity.ts` compara o Next com o cliente HTTP. Nesta candidata, a lista só exibe apurações confirmadas dos IDs dos pedidos da conta compradora ativa. Ensaio local com duas contas do mesmo organizador; não confundir com prêmios pessoais. |
| Meus prêmios / cotas premiadas pessoais | /comprador/meus-premios, vencedor do sorteio | **N de leitura nesta rodada:** seção “Meus prêmios” em Resultados separa prêmios de sorteio e cotas premiadas da conta. Não confirma recebimento, pagamento ou repasse. | L: `test-buyer-prizes-local.ts`, dois registros sintéticos com mesmos IDs/títulos pelo Next BFF e cliente móvel, comprador sem vínculo vazio, anônimo 401, organizador 403; testes e bundle, sem execução iOS. A rota de cotas no BFF não implica que o site a apresenta nessa página. |
| Painel/financeiro do organizador | Painel, extrato, conta e operações financeiras | **N parcial** no painel inicial, com totais agregados; **NE** para extrato, conciliação, taxas, saldo detalhado e saques. | Não há transação financeira externa testada aqui. |
| CRM e comunicação | Contatos, segmentos, tarefas e automações web | **W:** não há tela nem atalho CRM no fluxo alcançável desta candidata nativa. | Atalhos web testados no Chromium isolado; nenhuma entrega externa inferida. |
| Afiliados | Convite, área de afiliado e gestão via site | **W:** sem entrada nativa, atribuição ou comissões no app. | Aceite web local protegido por e-mail; não prova atribuição/repasse ou iOS. |
| IA | Painel web de recomendações | **W:** sem botões/fluxo nativo para IA nesta candidata. | Não inferir geração por provedor externo da existência do módulo web. |
| Notificações, favoritos e suporte | Áreas de comprador e comunicação no site | **W:** sem central, entrega push, favoritos ou suporte nas rotas alcançáveis do app. | Inspeção de navegação e dependências; nenhum envio externo. |
| Perfil, marca e configurações | Perfil, personalização, plano, documentos e regras | **N parcial:** nome, telefone, município, slogan do organizador e consulta de endereço/verificação. | Sem upload nativo de documentos, edição de endereço inteiro do comprador ou plano. Links legais externos não são telas de configurações. |
| Administração | Área web separada e verificação por papéis | **Restrito intencionalmente:** sem administração no app comum. | Suíte de autorização web/API; não é lacuna para inserir na versão pública do app. |

Os nomes “Portal”, “Crm resumo” e “Advisor resumo” da matriz anterior não são
evidência de caminhos nesta base: a árvore de navegação do app não expõe um
portal geral/WebView nem módulos CRM/IA. A cobertura do site não foi removida.

## Prova local desta rodada

`services/api/scripts/seed-buyer-prizes-local.cjs` exige um PostgreSQL recém-migrado,
vazio, em IPv4 loopback e chamado `sortex_prizes_local_<hex>`, informado por
`SORTEX_PRIZE_TEST_DATABASE_URL`. Use somente as três credenciais sintéticas
`SORTEX_PRIZE_TEST_{OWNER,OTHER,ORGANIZER}_{EMAIL,PASSWORD}`: e-mails de teste
`sortex-prize-<hex>@example.test`. O seed grava histórico fictício diretamente,
sem executar compra, provedor ou envio.

Com a API local em modo de desenvolvimento e o BFF Next apontando para a mesma
API, rode em `apps/mobile`:
`SORTEX_PRIZE_TEST_API=http://127.0.0.1:3338 SORTEX_PRIZE_TEST_WEB=http://127.0.0.1:4459 node --import tsx scripts/test-buyer-prizes-local.ts`.
O cliente usa memória como cofre no Node, não SecureStore. A exportação iOS é
bundle JavaScript e não substitui Xcode, simulador ou telefone.

Próximos P0/P1 locais sem depender de pagamento: validar o editor de rascunho e
a nova consulta no aparelho, completar upload/editor nativos por etapas e
corrigir a filtragem de resultados por campanha de pedido. Para compra com
PIX, exigir sandbox real separado, webhook e as evidências de aceite previstas.
