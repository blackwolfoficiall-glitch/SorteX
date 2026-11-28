# SorteX · Auditoria geral web e iOS
**25 de novembro de 2026 · decisão técnica: homologação integrada pendente.** O site e o cliente móvel conseguem compartilhar contas e campanhas quando usam a mesma API local. Na infraestrutura publicada, uma conta sintética aceita pela API usada pelo app foi recusada pelo site. Essa é a primeira correção necessária para que os testes seguintes representem a operação do usuário.

## Medição da entrega
| Medida efetivamente verificável | Numerador / denominador | Resultado e alcance |
|---|---:|---|
| Web, regressão geral de navegador | 73 / 82 executados | 89,0% aprovados. Dos 92 previstos, 9 falharam e 10 foram pulados. Cobertura com resultado aprovado sobre os 92 previstos: 79,3%. |
| App, suíte automatizada do projeto | 16 / 16 executados | 100% nessa suíte. TypeScript e exportação Metro iOS também passaram. Build nativo, simulador e iPhone físico não foram exercitados. |
| Paridade homologada na candidata web + iPhone | 0 / 9 cenários exigidos | 0% com aceite integral. Há evidências parciais locais em cinco cenários, detalhadas abaixo. |
| Conclusão funcional total do site e do app | Sem medição válida | O inventário inclui rotas compartilhadas, telas de leitura, integrações simuladas e jornadas de pesos diferentes. As taxas das duas suítes não medem quanto de cada produto está pronto. |

## Revisões e preservação
| Referência | Revisão | Achado |
|---|---|---|
| Trabalho mobile disponível | feat/mobile-expo em 2edf571 | Dois commits locais além de origin (2f1d137 e 2edf571). App.tsx, package.json e package-lock.json modificados; OrganizerPortalButton.tsx novo. |
| Mobile remoto observado | origin/feat/mobile-expo em 49d3733 | Divergência com infra web de 1 commit exclusivo da infra e 11 do mobile remoto; com o mobile local, 1 e 13. |
| Web candidata inspecionada | checkout destacado 67d5fa5 | Árvore 58cae61ae2dd2176aa253759c3c3401c71b53a8e idêntica à de infra/netlify-northflank-neon em 080c444. Equivalência de arquivos verificada. SHA efetivamente servido não atestado. |
| Outras referências | main 2b8e850; feat/cadastro-identidades-institucional 0860940 | A infra web tem respectivamente 27 e 4 commits exclusivos em relação a essas referências; as duas têm zero commits exclusivos frente a ela. |

Antes dos ensaios, foram copiados o diff rastreado (SHA-256 48d573e53034673aa9b5e0a6d7fb8c59dcf3b421ba1140cc24a125a775e7c1c7) e o componente novo (ea766620ca06c2394866dabc8820bdb28175ca69fb6e219e9e146f5d0f62c2e0). Os testes usaram cópias e bancos descartáveis. Não houve merge, push, alteração de código de produto, contratação, transação monetária ou publicação. O estado do diretório particular no Mac não pode ser inferido desses checkouts.

## Arquitetura, configurações e ambientes
- apps/web contém Next 16.2.12, React 19.2.4, rotas públicas, comprador, organizador, admin e handlers BFF. apps/mobile contém Expo 58.0.26, React Native 0.88.1, React 19.3 e React Navigation. A alteração local introduz WebView 14.0.1, dependência que precisa constar do binário.
- services/api contém Nest 11.1.28 e Prisma 6.19.3. São 102 modelos e 19 migrações. services/api tem o mesmo conteúdo nos dois candidatos inspecionados. packages/contracts pertence à linha mobile. A igualdade do código da API não identifica o serviço ou banco efetivamente acessado.
- A matriz anexa cataloga 107 páginas Next, 87 handlers/rotas de servidor, 443 declarações de endpoints Nest e 16 telas nativas. Contagens medem estrutura. O HTML de demonstração usa mocks; o painel publicado acessível pelo app apresenta links para rotas web. A abertura de um link por si só não testa a ação de negócio.
- Netlify serve o site. O BFF usa API_INTERNAL_URL ou API_URL; regras de reescrita também podem resolver a origem durante o build. Node 22 está configurado no Netlify; a execução desta auditoria ocorreu em Linux com Node 24.22. Revisar a paridade dos runtimes antes do aceite.
- DATABASE_URL define a conexão Prisma; as configurações de sessão e pagamento incluem JWT_ACCESS_SECRET, JWT_REFRESH_SECRET e PAYMENT_ENV. Valores não foram exportados. A documentação da infraestrutura descreve Neon; um health check não atesta identidade do cluster, região, restauração ou política de retenção.
- O site sortex-homologacao.netlify.app e /painel-mobile.html responderam 200. GET /api/health/ready do site retornou banco e storage disponíveis. Na API nativa em sortex-fase1-review.netlify.app/.netlify/functions/sortex-api, a prontidão indicou banco disponível e storage não inicializado.
- A mesma credencial sintética obteve 201 e o mesmo ID na revisão móvel, e 401 em /api/auth/login do site. Isso comprova a divergência do comportamento de autenticação. A causa exata (dados, configuração, tenant ou revisão implantada) requer conciliar os destinos efetivos. A WebView é privada e não recebe automaticamente a sessão guardada pelo app.

## Execuções e evidências
| Ensaio | Resultado | Limite da evidência |
|---|---|---|
| Instalação pelos lockfiles web/API, geração Prisma, TypeScript web/API/mobile, builds Next e Nest | Passaram | Builds de aplicação no host Linux |
| API Jest, em série | 44 suítes, 275/275 | Inclui regras e falhas de provedores simuladas |
| Configuração e empacotamento de funções | 18/18 após gerar o artefato requerido pelo teste | Primeira tentativa sem dist/neon falhou; não equivale a deploy |
| HTTP com PostgreSQL 18.7 descartável | 21 testes de cadastro/smoke mais 15 de vínculo/OIDC | 36 testes, identidade social simulada |
| Migrações, transação e integridade | Fixture histórica migrada de 16 para 19 migrações, rollback e unicidade validados | Sem restauração de cópia do banco hospedado |
| Cadastro fase 1 no navegador | 14/14 em desktop e viewport de iPhone | Chromium local, sem Safari ou hardware |
| Regressão web ampla, rodada final | 73 aprovados, 9 falhas, 10 pulados | Specs do projeto, configuração de runner temporária, Chromium local, Next em dev com seed controlado. Os resultados de tentativas anteriores não foram somados |
| Cliente mobile | 16/16 + integração HTTP da revisão de testes para comprador e organizadores PF/PJ | Incluiu cadastro, login, consultas, alteração/restauração e saída conforme papel. Três identidades sintéticas criadas na revisão de testes |
| Exportação do aplicativo | Bundles Hermes iOS e Android gerados | Assinatura, módulos nativos no binário, instalação, simulador e iPhone físico pendentes; sem Xcode no executor |
| Concorrência no banco | 8/8 pares simultâneos com uma reserva confirmada, um conflito 409 e uma gravação | Serviço real de compras e PostgreSQL, sem liquidação externa |
| Apuração histórica | 100/100 repetições coincidiram com o resultado esperado da regra exercitada | Cálculo em memória, sem publicação de ganhador |

### Nove falhas da regressão web
| Área | Resultado observado na última rodada |
|---|---|
| Automações | Mensagem esperada após executar a automação de sandbox não apareceu. |
| Campos numéricos | O teste não encontrou o cabeçalho Prêmios para prosseguir ao aceite de persistência. |
| Pedidos | Campo de busca não foi localizado pelo rótulo esperado. |
| Vínculo social, colisão de e-mail | O destino do link divergiu da expectativa na fixture da interface. |
| Vínculo social com e-mail diferente | Link de entrada na conta existente não apareceu na fixture. |
| Imagem do prêmio por meta | Controle Adicionar foto não apareceu para o teste. |
| Publicação do organizador | HTTP 400 com pendências de regulamento, descrição, imagem, horário e regra de sorteio. Conferir validade da fixture frente às regras atuais. |
| Campanha pública | Ordem exibida das premiações divergiu da expectativa. |
| Imagem e roleta | Link Campanhas apontou ao organizador, enquanto o teste exigia a raiz do site. |

Uma falha de asserção registra que o contrato esperado pelo teste não foi atendido. Para cada caso é preciso decidir se mudou o produto, o dado de teste ou a expectativa antes da correção. Os dez testes pulados não receberam crédito.

## Nove cenários de integração
| # | Evidência obtida | Falta para o aceite |
|---|---|---|
| 1. Campanha web → app | Criação de rascunho pelo BFF, HTTP 201, e mesmo ID em campaigns/my pelo cliente TypeScript do app com a mesma API local | Repetir pela interface no binário candidato |
| 2. Editar no app → site | O app encaminha ao editor pelo portal | Sessão, alteração persistida e releitura no site |
| 3. Cadastro web → login app | Cadastro BFF 201 e mesmo ID no cliente móvel local. Na hospedagem, a mesma identidade do app recebeu 401 no site | Alinhar ambientes e testar cadastro web → login no telefone |
| 4. Comprar no app → site | Checkout não identificado entre as ações nativas do comprador | Reserva, pedido, Pix de teste e consulta cruzada do ID |
| 5. Webhook nos dois | Testes locais cobrem tratamento de eventos simulados | Entrega do provedor sandbox e atualização das duas UIs |
| 6. Títulos, ganhador e saldo | Modelos e leituras parciais disponíveis | Provar três resultados persistidos e conciliados na mesma transação de teste |
| 7. Venda duplicada | Oito disputas de reserva, cada uma com uma gravação | Aprovação do pagamento e unicidade final do título e do lançamento |
| 8. Isolamento | Dois organizadores sintéticos listaram exclusivamente os próprios rascunhos, pelo cliente contra o servidor local | Escrita, relatórios, mídia e troca de identidade no portal |
| 9. Administração | BFF local autenticou superadmin (200), rota usada pelo painel /api/admin/platform/dashboard retornou 200 e totais; app recusou sessão admin | Perfis limitados, aprovar/rejeitar, revogar e reler trilha na candidata |

## Lacunas entre produtos
No web existem editores de campanha, promoções, cotas premiadas, ganhadores, afiliados, financeiro e administração. Boa parte do menu móvel abre o portal; as telas nativas de campanha, pedidos, CRM e recomendações são sobretudo de consulta. Seleção/reserva e checkout do comprador, edição nativa, login social ativo e recebimento de push no aparelho carecem de implementação ou evidência conforme a matriz. A área administrativa é deliberadamente restrita ao web na revisão móvel. No site, as maiores lacunas identificadas são operação automática da Federal, fluxo de transmissão Live e execução externa dos gateways adicionais, split e saques. Emissão de notificações externas, pagamentos e ações apenas ligadas a uma interface permanecem sem aceite integral.

## Financeiro e apuração
| Componente | Implementação/evidência | Pendência |
|---|---|---|
| Mercado Pago | Adaptador concreto restrito a sandbox; testes simulam criação Pix/cartão, aprovação por webhook, assinatura, referências/valores divergentes, repetição, timeout, expiração, cancelamento e lançamentos | Criar e aprovar um pagamento no sandbox do provedor, receber reentrega, conciliar título, pedido e saldo nos dois clientes |
| Stone, PagBank, Pagar.me | Sem adaptador de cobrança operacional identificado no seletor de gateways | Configuração visível não certifica cobrança. Não incluir como gateways homologados |
| Split, saques e conciliação | Modelos e fluxos internos de razão financeira e solicitação/aprovação; faltam comprovantes do repasse externo | Demonstrar liquidação de sandbox, idempotência, estorno e reconciliação pelo mesmo ID |
| Loteria Federal | Provedor manual. Regras-modelo e personalizadas, inclusive reversão e zeros, têm cobertura no motor; snapshot na publicação e hash têm cobertura parcial | Automatização da captura, convenção de entrada, histórico persistido e imutabilidade ponta a ponta |

Na extração oficial 6000 de 13/09/2025, as cinco strings traziam seis dígitos e começavam com zero. A entrada bruta foi recusada pelo motor de cinco dígitos. Neste exemplo, apenas para testar o cálculo, foi removido exatamente um zero inicial de cada prêmio. A concatenação das unidades dos cinco prêmios produziu 27764 em 100 repetições. A convenção precisa ser validada para outras extrações antes de alimentar campanhas; não foi realizado sorteio real. [Resultado oficial utilizado](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6000)

## Segurança, privacidade e continuidade
Foram inspecionados os guards de JWT, papéis e permissões administrativas do Nest, a validação global de DTOs e os controles de cookies (HttpOnly, SameSite e Secure na configuração de produção). O app usa SecureStore. A revisão local e os testes sustentam a existência desses controles; falta verificar configuração, expiração e revogação nos clientes publicados.

A inspeção de assinaturas conhecidas no código web não encontrou os padrões procurados. O resultado não cobre todo o histórico, segredos nos provedores ou todos os formatos. O rate limiting inspecionado usa memória por processo; cabe validar múltiplas instâncias e a origem confiável do IP atrás do proxy. Antifraude e trilhas possuem superfícies de código; faltam evidências de operação e alertas do ambiente alvo.

Cadastro e registros de consentimento têm testes. Retenção, eliminação/exportação de dados, restrição a documentos, mascaramento de logs e restauração completa de banco e objetos precisam de evidência operacional. A rotina descrita em docs/backups.md não foi executada sobre um backup da hospedagem. O checklist mantém esses itens abertos; esta revisão técnica não representa certificação jurídica.

## Decisão e prazo
Priorizar ambiente único, sessão entre app e portal e build identificável no iPhone. Só então medir edição, checkout, webhook, ganhadores e financeiro pelos mesmos IDs. Até segunda-feira 30/11 é possível decidir sobre um recorte de homologação interna se houver máquina com Xcode, aparelho, acessos de teste e pessoas disponíveis. Para os nove cenários do núcleo, a previsão inicial é de 5 a 10 dias úteis de trabalho em paralelo com web/API, mobile e QA, condicionada ao sandbox e à triagem das regressões. Não há base para prometer paridade total de todos os módulos até essa data.
