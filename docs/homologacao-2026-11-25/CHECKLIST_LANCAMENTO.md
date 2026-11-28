# Checklist de decisão • web e app iOS

**Status em 25/11/2026: homologação integrada pendente.** Marcar uma caixa somente com evidência do ambiente e revisão correspondentes.

## Evidência já obtida

- [x] Identificar branches, divergência e arquivos locais alterados.
- [x] Compilar Next.js e NestJS; verificar TypeScript em web, API e app.
- [x] Gerar bundles Metro iOS e Android; testar cliente mobile e rotação de sessão.
- [x] Migrar um PostgreSQL descartável, preservar a fixture legada e verificar rollback de escrita parcial.
- [x] Passar cadastro em Chromium desktop e emulação móvel, com API e PostgreSQL locais.
- [x] Comparar ID de conta e ID de campanha entre BFF e cliente TypeScript do app na mesma API local.
- [x] Reproduzir concorrência real de reserva em PostgreSQL; em oito pares houve uma gravação por cota.
- [x] Repetir cálculo de regra com extração histórica em memória.
- [x] Comprovar falha de interoperabilidade da mesma credencial sintética nos dois serviços publicados.

## Exigências para homologar a revisão candidata

- [ ] P0 • Registrar as revisões de web/API/mobile e fixar o ambiente comum de teste, incluindo a URL do BFF em build e runtime.
- [ ] P0 • Demonstrar login comum, políticas idênticas e comportamento de logout/expiração no portal.
- [ ] P0 • Build nativo de desenvolvimento no Xcode; teste no simulador identificado por modelo e versão.
- [ ] P0 • Instalar no iPhone físico, registrar versão iOS, binário, WebView, retomada após perda de rede e troca de conta.
- [ ] P0 • Passar os cenários 1–9 do plano no ambiente alvo; anexar IDs sintéticos e horários.
- [ ] P0 • Receber webhook Mercado Pago sandbox, repetir, expirar, cancelar e conciliar. Demonstrar uma única venda e um lançamento por evento.
- [ ] P0 • Demonstrar edição no telefone, checkout do comprador e resumo financeiro com a mesma base do site.
- [ ] P0 • Validar histórico imutável de apuração, resolução do ganhador e visibilidade por papel.
- [ ] P0 • Validar administração e isolamento de leitura/escrita no servidor; repetir com sessões distintas.
- [ ] P1 • Corrigir ou explicar falhas Playwright por suíte; executar navegador móvel e Safari/WebKit nos fluxos críticos.
- [ ] P1 • Validar Apple e Google reais na configuração de teste, ou registrar sua indisponibilidade expressa para a versão candidata.
- [ ] P1 • Confirmar storage privado, acesso por papel, remoção, backup e restauração de um documento sintético.
- [ ] P1 • Rever credenciais por ambiente, redaction, limites distribuídos, consentimento versionado, exportação/exclusão e retenção.
- [ ] P1 • Distinguir configuração de gateway, lançamento contábil, split e saque liquidado.
- [ ] P1 • Registrar evidências das ações do portal por módulo, inclusive mídia, CRM e notificações.

## Evidência mínima por caso

Data/hora, SHA web/API e versão do binário, ambiente, papel, operação no dispositivo, resultado na outra interface, ID de correlação, leitura após recarregar, esperado/observado e decisão. Excluir tokens, cookies, senhas, documentos e dados financeiros pessoais dos anexos. Dar o aceite por ambiente, por papel e por fluxo.

## Execução de 25/11

- [x] Criar integração isolada a partir das branches publicadas e verificar as árvores importadas.
- [x] Rodar paridade HTTP real de cadastro/login em ambos os sentidos, rascunho e isolamento em PostgreSQL local.
- [ ] Preservar e integrar commits/diff exclusivos do Mac.
- [ ] Repetir na candidata hospedada e instalada no iPhone. Não somar o teste HTTP local ao aceite formal.
