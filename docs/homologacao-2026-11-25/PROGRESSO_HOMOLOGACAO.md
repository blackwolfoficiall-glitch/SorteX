# Progresso da homologação Web + iOS

## Candidata de 25/11/2026

- Integração isolada: `homologacao/web-ios-integrada`. O merge `6f8ba343bdf20e28a0e1d10fef8d3db746a42573` preservou as duas histórias e não mudou nenhuma árvore de produto importada: web/API de `080c444` e mobile publicado em `49d3733`. Backups locais das referências remotas foram registrados. As branches remotas originais não foram alteradas.
- O GitHub e o executor cloud não tinham `2edf571`, `2f1d137`, `67d5fa5` nem a cópia dos arquivos da WebView não commitados. A árvore web em `080c444` é `58cae61ae2dd2176aa253759c3c3401c71b53a8e`, igual à árvore de `67d5fa5` atestada pela auditoria. Falta preservar os objetos e o diff no Mac antes de reconciliar a candidata móvel. Não fazer reset ou aplicar patch em seu checkout original.
- O site principal respondeu com backend `a6904fc`. O BFF da revisão Fase 1 e a função usada pelo app remoto responderam com `c71e243`. A divergência de rotas/revisões é comprovada. O motivo específico do 401 no site principal, as chaves JWT e a identidade do banco hospedado não estão atestados. Nenhum dado remoto foi modificado.
- A candidata usa um único resolvedor web tanto para rewrites quanto para rotas de servidor. A ativação de `SORTEX_HOMOLOGATION_API_URL` em Builds **e** Functions rejeita destinos antigos divergentes. A candidata hospedada ainda precisa repetir o teste de ambiente e confirmar o mesmo banco lógico; variáveis só de build não bastam.
- O primeiro teste integrado confirmou, em PostgreSQL 18.7 descartável e 19 migrações aplicadas, Next/Nest e cliente HTTP do app: cadastro/login de organizador em ambos os sentidos, mesmos IDs de usuário e perfil, mesma permissão, rascunho com mesmo ID, edição vista no web, logout e isolamento entre dois organizadores. O cliente foi executado no Node com memória em vez de SecureStore; não foi executado no iPhone.
- **Aceite integrado formal: 0/9** até verificar os nove cenários da auditoria na mesma candidata hospedada e no aparelho. Os cenários #1, #2, #3 e #8 têm nova evidência local, sem contá-la como aceite. Próximos portões: preservar o Mac, preparar candidata isolada, pagamentos de teste do provedor, iPhone nativo, outros cenários e revisão final. A meta de 30/11 é de núcleo, condicionada aos acessos.

## Como repetir o teste local

1. Crie um PostgreSQL descartável e aplique as migrações com `prisma migrate deploy`. Não reutilize a URL de uma base de homologação compartilhada ou produção.
2. Rode a API Nest de desenvolvimento em `127.0.0.1:3338` com chaves locais novas, `PAYMENT_ENV=test`, sem credenciais dos provedores e com `APP_VERSION` igual ao SHA validado. Configure o Next com `API_INTERNAL_URL` e `SORTEX_HOMOLOGATION_API_URL` iguais ao endereço local dessa API.
3. Em `apps/mobile`, execute `SORTEX_PARITY_WEB=http://127.0.0.1:4408 SORTEX_PARITY_API=http://127.0.0.1:3338 node --import tsx scripts/test-web-ios-parity.ts`. O teste rejeita URL remota/API não marcada como desenvolvimento e escreve apenas dados sintéticos. Ele não publica campanhas nem toca pagamentos.
4. Em `apps/web`, execute `node --test lib/api-upstream.test.mjs` com Node 22+ que suporte TypeScript nativo, ou use a versão Node 24 da validação.

## Renovação de sessão

A API agora vincula cada renovação à credencial completa e emite um identificador novo por refresh, inclusive para renovações no mesmo segundo. A alteração não apaga contas nem modifica a tabela de sessões. Registros de refresh legados deixam de renovar; na implantação aprovada, comunique que esses usuários precisam reautenticar. Esse comportamento foi testado no backend, não no SecureStore do aparelho.

## Evidências adicionais de 25/11

| Área | Entrega desta rodada | Prova e limite |
|---|---|---|
| Web | Correções nas nove falhas da auditoria; revisão de seleção de mídia, retorno de automações, busca de pedidos, ordem de prêmios e URL canônica da capa no comprador. | 93/93 no Chromium no laboratório local; 32/32 no WebKit com viewport de iPhone e capa real. Não prova OAuth real nem hardware. |
| Organizador móvel | Criar e editar rascunhos nativos com os componentes visuais existentes e a API central. | HTTP real local comprovou criação/edição bidirecional, mesma entidade, papéis, renovação de sessão e isolamento. A tela ainda precisa do iPhone. |
| Comprador móvel | Reserva manual/aleatória, prazo do servidor, cancelamento, consulta do pedido e títulos apenas quando confirmados. Montado sob flag de teste. | Vitórias locais HTTP + PostgreSQL e tipo/bundle iOS. Não houve pagamento, título liquidado no provedor ou teste físico. |
| Financeiro | Conciliar reversões sem duplicação e não informar gateways indisponíveis como conectados. | Regressão com assinatura e persistência local; resposta do provedor controlada. Ainda falta pedido e webhook real do sandbox. |
| Federal | Importar concurso oficial para revisão, guardar cinco valores brutos, hash e representação canônica sem perder zeros. | CAIXA 6091 via navegador, teste HTTP/PG de revisão e trava. Sem publicação automática ou comparação no iPhone. |
| Storage | Inicializar diretório privado local/montado, distinguir arquivos desabilitados e restringir documentos ao dono ou revisor autorizado. | HTTP + PostgreSQL + filesystem isolados; acesso e auditoria verificados. Bucket hospedado e restauração continuam abertos. |
| Infraestrutura | Criado projeto Neon Free separado `sortex-web-ios-qa`, PostgreSQL 18, sem cópia das bases existentes. | Consulta de catálogo confirmou zero tabelas de aplicação. A tentativa de acesso direto para aplicar migrações recebeu Prisma P1001 neste executor; API e site ainda não foram ligados a ele. |

**Não é homologação final.** Estado formal de aceite: 0/9. Preservar o checkout do Mac antes de conciliar WebView, executar instalada no iPhone e usar credenciais verificadas da área Teste, sem escanear Pix ou movimentar dinheiro. A aprovação da App Store e autorizações jurídicas/comerciais são portões externos distintos.
