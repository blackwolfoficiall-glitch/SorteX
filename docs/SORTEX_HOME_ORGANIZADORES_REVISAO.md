# SorteX — revisão da inicial para organizadores

Data: 14/11/2026 (America/Bahia). Branch exclusiva: `feat/cadastro-identidades-institucional`.
Base preservada: `c3554ef`. Esta revisão complementa [o escopo integrado](SORTEX_ESCOPO_INTEGRADO_REVISAO.md); não cancela pendências anteriores.

## Escopo e evidências

| Solicitação | Situação |
| --- | --- |
| Identidade roxa e “Sua campanha, em outro nível” | Preservadas; apresentação e CTAs priorizam organizadores |
| Participante como caminho secundário | Link real para `/cadastro/comprador` mantido |
| Dashboard demonstrativo consistente | Conta Aurora Demo exclusiva no Neon da prévia, com 1.250 participantes únicos, 1.250 pedidos pagos simulados, 48.750 cotas de R$1 e R$48.750 de receita |
| Campanhas preenchidas | Jornada Aurora: 500 pedidos, 19.500 cotas/R$19.500; Experiência Horizonte: 450, 17.550/R$17.550; Projeto Essência: 300, 11.700/R$11.700. Três publicadas, compras bloqueadas |
| CRM e relacionamento | 1.370 contatos: 1.125 clientes, 125 VIPs, 100 leads e 20 inativos; gasto dos compradores totaliza R$48.750. Um segmento e uma tarefa; 12 reservas expiradas e 12 aguardando pagamento |
| Conta sem aviso de análise | Apenas a nova fixture foi criada VERIFIED; nenhum organizador existente teve status alterado. O aviso real permanece no código |
| Prints reais desktop/mobile | Capturas da interface autenticada local, usando somente o banco isolado, sem interceptar dados ou cobrir avisos; recortes e rolagem identificados como demonstração fictícia |
| Dashboard, CRM, IA e Loteria Federal em destaque | Seções específicas com benefícios concretos e limites; referências abaixo |
| Planos e preços | Quatro cards preparados. Mensalidades, limites e condições finais ainda pendentes de aprovação; nenhum valor histórico publicado como oferta |
| Composição/navegação | Proposta + dashboard; diferenciais; demos dashboard/CRM/IA; campanhas/apuração; outros módulos; planos; FAQ; CTA organizador. Navegação Recursos/Como funciona/Planos |
| Login/cadastro e Google/Apple | Layout e fluxos preservados. Imagem anterior das telas de acesso copiada sem alteração para `access-preview.png`; somente seu caminho foi ajustado para manter as proporções aprovadas |
| Publicação/revisão | Somente `sortex-fase1-review.netlify.app`; ver registro de validação final abaixo |

## Módulos conferidos antes dos textos

- **Dashboard:** `services/api/src/organizer-platform/organizer-platform.service.ts`, `apps/web/components/dashboard/OrganizerDashboard.tsx`. Receita PAID, participantes únicos, cotas e campanhas vêm da base. O gráfico anterior tinha barras fixas: foi substituído por histórico real de vendas confirmadas, agregado por dia UTC, com seletores Hoje/7 dias/30 dias/12 meses. Conversão/visitantes indisponíveis continuam “—”, sem inventar métricas. Card de gateway deixou de afirmar conexão não verificada; a linha de campanha usa “cotas vendidas”, não “participantes”. São correções necessárias para a demonstração fiel.
- **CRM:** `services/api/src/crm/crm.service.ts`, `crm-sync.service.ts`, controllers e `apps/web/app/dashboard/crm`. Contatos, tags, segmentos, notas, histórico, tarefas e notificações internas têm implementação. `docs/crm-automations.md` descreve limitações; a referência a migrations futuras naquele documento é histórica, não o estado desta prévia. Mensagens externas não são consideradas enviadas: providers WhatsApp/SMS/e-mail ainda dependem de configuração, e delivery externo permanece desligado.
- **IA SorteX:** `services/api/src/growth/ai-advisor.service.ts` e `apps/web/components/growth/AiSortexCenter.tsx`. Snapshot, alertas, ações confirmadas, perguntas sobre indicadores, simulações aritméticas e rascunhos existem. Sandbox usa regras/modelos determinísticos. Caminho para modelo externo está no código, mas não foi habilitado, contratado ou anunciado como ativo. Não se promete previsão de vendas nem geração autônoma de receita.
- **Loteria Federal:** `services/api/src/draws/{draws.service,draw-rule-engine.service,lottery-results.provider}.ts` e controllers; `campaigns/draw-rule-templates.controller.ts`. Cadastro/revisão manual de resultados, regras, simulação e auditoria existem. `ManualLotteryResultsProvider` informa consulta externa desativada. Resultado oficial deve ser conferido na fonte oficial; regra pertence à campanha. Nenhuma parceria/autorização da Caixa é sugerida. Não houve sorteio real nesta revisão.
- **Campanhas/pedidos/financeiro:** módulos e telas existentes consultados. Demonstração usa registros simulados; não cria liquidação bancária, saques ou disponibilidade financeira real. Não anunciar processamento financeiro real homologado.
- **Afiliados/personalização:** programas, links, conversões, comissões e identidade têm implementação. Pagamento real de comissão não foi homologado. Domínio próprio depende de plano/configuração; prévia usa Netlify. Não habilitados fornecedores pagos.
- **Planos por recurso:** `PlanFeature` no catálogo associa CRM/afiliados/personalização ampliada ao Profissional e IA/automações/domínio ao Avançado. Isso é configuração técnica; não substitui confirmação do pacote comercial nem prova uniforme de enforcement em todos os endpoints. Não se alteraram permissões nesta tarefa.

## Fonte comercial e pendência exata

Consultados: model `Plan`/`PlanFeature`, endpoint público implementado por `plans.controller.ts`, edição administrativa `apps/web/app/admin/planos/page.tsx`, migration `20260714030634_plans_personalization_orders_mini_campaigns/migration.sql:68`, documentação e tabela do Neon exclusivo. Consulta **somente leitura** ao catálogo público do ambiente existente (`/api/plans`) retornou HTTP200 e os mesmos valores herdados: Inicial R$0, Profissional R$79,90, Avançado R$149,90, Empresarial R$299,90. Os registros foram criados pela migration; não foi encontrado registro posterior de aprovação comercial. Não se entrou no painel administrativo como proprietário nem se editou esse catálogo.

**Esses valores não foram publicados na página como preços vigentes aprovados.** É necessário confirmar mensalidade em reais de cada um dos quatro planos, periodicidade/renovação, limites, benefícios e demais cobranças/condições antes de contratação. Foi solicitada a tabela vigente ao proprietário; os cards usam “A confirmar”, explicam periodicidade mensal e levam ao cadastro sem selecionar/ativar assinatura. Não exibem percentuais, descontos, promoção, “mais escolhido” ou alegação de ausência de taxas.

## Isolamento, segurança e reversão

- Site exclusivo: `af720ddb-9366-4e26-bcfe-d92ea8c27caf`.
- Neon exclusivo: `rough-cherry-09901194`, branch `br-weathered-grass-bcisqlpm`, banco `sortex_preview`. Sem nova migration; histórico de 19 migrations preservado.
- `seed-organizer-demo.cjs` recusa outro host/banco, exige autorização explícita/sandbox/delivery desabilitado, usa transação e recusa sobrescrita da conta. Dados `.invalid`, compradores de fixture inativos e senha aleatória fora do Git. Não usa SDK de pagamento, mensagens, webhooks ou chamadas de IA pagas. Nenhuma conta real foi aprovada ou reclassificada.
- As compras demonstrativas são bloqueadas publicamente. Os pagamentos APPROVED são fixtures diretas, com metadata `testOnly/simulated/noProviderRequest`; não são prova de transações reais, liquidação ou recuperação de dados antigos. O seed não cria assinatura/fatura cobrável.
- Netlify Free e Neon `free_v3` reconfirmados nesta revisão; sem cartão/upgrade/recarga. Cotas podem suspender serviço; não se promete disponibilidade ilimitada.
- `main`, `infra/netlify-northflank-neon`, site `sortex-homologacao`, banco original, Render, backups e uploads do Mac preservados. Dados antigos continuam não restaurados.
- Reversão por commit seletivo revisado e nova publicação somente da prévia. Não resetar/drop/resetar banco nem apagar fixtures automaticamente; não reverter suporte social de contas que dependam dele.

## Pendências preservadas do conjunto anterior

1. Google real: cliente Web/consentimento e variáveis exclusivas da prévia, seguidos de round trip com conta real.
2. Apple real: verificar conta Developer existente habilitada/isenção e configurar identificadores/chave; não contratar associação paga. Botões continuam desabilitados enquanto a configuração estiver ausente.
3. Complementação/vínculo social têm testes com fixtures; autenticação real dos provedores permanece pendente. Sem fusão por coincidência de e-mail.
4. Safari real/VoiceOver/Android físico e aceite visual do proprietário ainda pendentes; emulação Chromium não substitui aparelho real.
5. Tabela comercial final, contato oficial e termos/política definitivos aguardam confirmação/revisão.
6. Dados, contas reais, bancos e uploads antigos do Mac não restaurados.

Guia externo: [SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md](SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md).

## Validação e publicação

Registro final será acrescentado após conferir o endereço publicado. Verificações locais já realizadas: 275 testes unitários/44 suítes; 5 proteções do seed; 12 cenários novos de navegador em desktop/iPhone/Pixel Chromium; TypeScript e build da API aprovados. Resultados definitivos de build, lint, regressão pública e capturas serão registrados após o deploy.
