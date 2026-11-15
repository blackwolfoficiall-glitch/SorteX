# SorteX — composições comerciais próprias

Data: 15/11/2026 (UTC). Branch: `feat/cadastro-identidades-institucional`. Base: `9f9488b`.

Esta revisão substitui a decisão anterior de usar capturas do sistema na página inicial. O histórico e seus arquivos são preservados, mas a inicial não referencia mais esses prints. Login e cadastro aprovados continuam com sua apresentação anterior, sem alteração nesta tarefa.

## Solicitações e estado

| Solicitação | Implementação e limites |
| --- | --- |
| Identidade e foco no organizador | Marca, roxo, título e CTAs preservados. Participante continua como caminho secundário |
| Dashboard inteligente | Composição React/HTML/CSS com gráfico SVG, R$48.750 fictícios, três campanhas, totais por campanha e curva ilustrativa acumulada; não consulta contas nem API |
| CRM | Contatos fictícios, segmentos e oportunidade de revisar reservas; sem dados pessoais, envio ou botões operacionais |
| IA SorteX | Pergunta/resposta e recomendação estáticas explicitamente exemplificativas; baseadas no snapshot/alertas/rascunhos existentes. Não simula sessão de IA funcional ou envio automático |
| Loteria Federal | Exemplo 71342 → últimos três dígitos → 342 em universo de 1.000 números; seleção centena/dezena/unidade suportada pelo motor de regras. Nada foi apurado; fonte oficial e regra do organizador distinguidas, sem vínculo com a Caixa |
| HTML/SVG nítidos | Nenhum `img`, `picture`, `canvas` ou imagem raster nas demonstrações da inicial. Textos HTML selecionáveis; gráfico com nome acessível; ícones decorativos ocultos dos leitores de tela |
| Mobile compacto | Conferido em 320, 390 e 1440 px; composições entre 395 e 494 px no celular, sem sequência de cards administrativos ou transbordamento |
| Identificar exemplos | Cinco composições (dashboard no hero e no detalhe, CRM, IA, apuração) com legenda “Ilustração demonstrativa · dados fictícios” |
| Painel real preservado | Nenhum arquivo do dashboard, backend, autenticação, cadastro ou schema modificado. Nenhum seed, aprovação de conta ou migration nesta revisão; testes de regressão podem criar somente novas fixtures sintéticas no banco isolado |
| Planos e preços | Cards e ressalvas preservados; mensalidades/benefícios/condições finais continuam pendentes da tabela vigente aprovada. Valores históricos não publicados como oferta |
| Prévia e testes finais | Registro da publicação e evidências a completar após conferir o endereço público |

Arquivos: `apps/web/components/marketing/ProductIllustrations.tsx`, `ProductHome.tsx`, CSS dedicado importado somente pela inicial e testes de apresentação atualizados para conferir SVG/HTML em vez de prints.

## Validação local

- TypeScript e lint dos arquivos alterados aprovados, sem erros.
- 15 testes Playwright da apresentação aprovados, desktop/iPhone/Pixel Chromium. Cobrem navegação, cadastro de organizador, planos sem valores não confirmados, ausência de imagens/controles falsos, tamanho compacto e identificação das ilustrações.
- Conferência visual em 320/390/1440 px: sem erro JavaScript observado ou transbordamento. Primeira tentativa dos testes parou por falta de espaço; após liberar exclusivamente cache Docker de build sem uso há mais de 24h, os testes passaram. Não foram removidos código, imagens Docker, containers, volumes, bancos ou backups.
- PNGs antigos permanecem preservados como histórico/recursos não referenciados pela inicial. A imagem anterior do login/cadastro e seus arquivos continuam intactos.

## Continuidade obrigatória

Esta tarefa não encerra o escopo integrado anterior. Google e Apple reais dependem de configuração externa/conta elegível e round trip de validação. Login tradicional, complementação/vínculo seguro e validações PF/PJ/IBGE preservados. Safari real/VoiceOver e Android físico pendentes. Dados e uploads reais do Mac não restaurados. Tabela comercial aprovada, contato oficial e textos jurídicos definitivos seguem pendentes.

Referências: [guia social](SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md), [escopo integrado](SORTEX_ESCOPO_INTEGRADO_REVISAO.md), [revisão anterior e fonte comercial](SORTEX_HOME_ORGANIZADORES_REVISAO.md).

## Isolamento e publicação

Somente site `sortex-fase1-review` (`af720ddb-9366-4e26-bcfe-d92ea8c27caf`), banco já isolado e segredos próprios. Nenhuma configuração de autenticação, banco ou infraestrutura do ambiente existente alterada. Netlify Free reconfirmado; sem cartão/upgrade/cobrança. Runtime da API reaproveitado sem mudança funcional; somente identificador público de versão da prévia atualizado para conferir o deploy. Sem merge, reset ou deploy do ambiente principal.

Reversão por commit seletivo revisado e nova publicação somente da prévia, sem apagar dados ou arquivos históricos. Relatórios posteriores apenas de evidências não exigem novo deploy do código.
