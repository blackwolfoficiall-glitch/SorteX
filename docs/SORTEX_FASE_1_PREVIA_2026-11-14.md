# SorteX — prévia isolada da Fase 1

Data: 14/11/2026 (America/Bahia).
Repositório: https://github.com/blackwolfoficiall-glitch/SorteX.
Branch de revisão: `feat/cadastro-identidades-institucional`.

Este registro complementa, sem substituir, `SORTEX_FASE_1_IMPLEMENTACAO_2026-11-14.md` e a auditoria da Fase 0. Aqueles documentos descrevem a fotografia anterior à autorização de push e publicação desta prévia.

## Acesso e isolamento

- Site: https://sortex-fase1-review.netlify.app
- API: https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api
- Saúde com banco: https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api/health/ready
- Projeto Netlify exclusivo: `af720ddb-9366-4e26-bcfe-d92ea8c27caf` (`sortex-fase1-review`).
- Projeto Neon exclusivo: `rough-cherry-09901194` (`sortex-fase1-preview`).
- Branch Neon: `br-weathered-grass-bcisqlpm`; banco `sortex_preview`.
- Deploy validado: `6af86256b74c756f91e17e1a`.

O NestJS existente foi publicado como uma função Netlify exclusiva da prévia. Não houve reconstrução da aplicação, substituição do Prisma/PostgreSQL ou mudança no algoritmo de senha. O adaptador recusa outro site, outro banco, outro host Neon e configurações fora de sandbox. As rotas do frontend usam o BFF Next.js existente e essa API.

O código da aplicação foi empacotado a partir de `72a0aa0d437c21fe513ad9ebcaba14643043e816`, com a correção de empacotamento Linux x64 incluída no commit que adiciona este relatório. Os commits posteriores de validação/empacotamento/documentação não alteram esse código da aplicação. O deploy manual não preencheu `commit_ref` da Netlify; não se afirma verificação automática por esse campo. Para identificar exatamente o artefato revisado, use o ID do deploy acima e o histórico desta branch.

O commit original `5a8fd10` foi preservado em branch local de preservação. O GitHub recusou sua autoria privada (GH007); `ccd8417bfda74a672bed2832fecb448ad843833d` tem a mesma árvore de arquivos e autoria pública noreply. A privacidade do GitHub não foi desabilitada e não houve force push.

O projeto `sortex-homologacao` continua no deploy `6af775bfbc4b537efbd7868f`, verificado por leitura após a publicação da prévia. Seu banco, variáveis e regras de acesso não foram modificados. As branches `main` e `infra/netlify-northflank-neon` não receberam estas alterações. Render, backups e arquivos do Mac permaneceram intocados. Nenhum merge ou deploy do ambiente existente foi feito.

## Banco, sessões e dados

Foram aplicadas somente no banco novo de revisão as 16 migrations históricas e as duas aditivas da Fase 1:

- `20261113230000_registration_identities`.
- `20261113231000_canonical_identity_uniqueness`.

Não houve reset, restauração sobre dados existentes nem cópia do banco publicado. Foram criadas contas sintéticas na estrutura antiga antes das duas migrations novas, incluindo sessões reais de teste. Após a migração, comprador e organizador renovaram suas sessões pela API publicada com os mesmos IDs e papéis. `personType` continuou nulo no perfil antigo, o slogan foi preservado e nenhum endereço foi exigido/criado retroativamente para o comprador antigo.

Essa evidência cobre fixtures de compatibilidade. **Não significa que as contas/dados reais antigos foram recuperados.** Os dados antigos e uploads do Mac ainda dependem de acesso e backup validado. A prévia contém somente dados sintéticos.

## Resultados da validação publicada

| Verificação | Resultado |
| --- | --- |
| HTML, JavaScript e CSS públicos | HTTP 200, tipos de conteúdo corretos |
| API `/health/ready` | HTTP 200, `status=ready`, `database=up` |
| BFF `/api/location/states` | HTTP 200, JSON |
| Playwright remoto: desktop + iPhone 13 Chromium + Pixel 7 Chromium | **21/21 aprovados** |
| Cadastro comprador, organizador PF e PJ | Aprovados em cada projeto de navegador |
| Endereço persistido e código IBGE | Conferidos diretamente no banco novo: 3 compradores, 3 PF e 3 PJ dos testes de navegador |
| CNPJ alfanumérico | 3 cadastros PJ persistidos com letras |
| Consultas de localidade indisponíveis, catálogo local, retry e cidade inválida | Aprovados |
| Teclado, troca de UF, CEP tardio e largura mobile | Aprovados nos cenários automatizados |
| Configurações → Perfil: salvar, recarregar, limpar slogan | Aprovado nas três configurações de navegador |
| Organizador REJECTED → correção cadastral → PENDING | Aprovado por HTTP; ID, papel, sessão e motivo anterior preservados |
| Organizador CORRECTION_REQUESTED → correção → PENDING | Aprovado por HTTP com as mesmas verificações |
| Sessões anteriores às migrations | Refresh e acesso autenticado aprovados para comprador e organizador sintéticos |
| CPF inválido, combinação município/UF inválida, endereço ausente e PJ sem CNPJ | 4 respostas HTTP 400; nenhuma conta inválida persistida |
| Varredura de credenciais nos assets públicos | Nenhuma ocorrência dos segredos novos/URL privada do banco |

As consultas indisponíveis foram simuladas somente no navegador de testes; a aplicação publicada não usa respostas falsas para concluir cadastro. Registro, login, edição e persistência passaram pela API e pelo Neon reais desta prévia.

Também passaram TypeScript do frontend, lint dos arquivos novos de teste (zero erros), 4 testes do adaptador, 3 testes de proteção do uploader e 2 testes novos do empacotamento (binding x64, compatibilidade de hash existente, recusa de sobrescrita e arquivos inseguros). As verificações anteriores de implementação registraram 258 testes unitários, 21 testes HTTP locais e 14 cenários Chromium locais; esses números são evidências anteriores, não novas execuções remotas. Builds Next.js/NestJS e empacotamento foram concluídos durante o preparo da prévia.

**Pendente:** Safari real no iPhone, VoiceOver e navegador em aparelho Android físico. A emulação Chromium de iPhone não substitui Safari real. Não há certificação de ausência de regressões em fluxos fora dos cenários executados.

## Falhas investigadas e correções

1. **404 na gestão Neon com a chave de Actions:** a integração conectada alcança o projeto novo, mas a credencial já existente no workflow recebeu 404 nesse projeto. Seu escopo não foi ampliado e `NEON_API_KEY` não foi alterada. O uploader opcional agora aceita somente uma credencial exclusiva da prévia; não é necessário configurá-la para a solução publicada.
2. **Rejeição do ZIP pela integração:** ZIP/CRC/base64 e limites do pacote foram conferidos. A chamada grande foi rejeitada por timeout da validação de padrão do conector antes do deploy. Um pacote mínimo de diagnóstico conseguiu publicar pela integração. Esse diagnóstico não é a API SorteX. Não foram desativadas verificações ou habilitados planos pagos para contornar o problema.
3. **Alternativa autenticada:** Netlify CLI já autorizada publicou frontend e API no projeto exclusivo. O workflow da branch agora só valida código/build; não lê segredos e não faz deploy ou migrations automáticos.
4. **Variáveis no Free:** a API de configuração recusou scopes granulares e marcação de segredo. Após autorização explícita, foram usadas variáveis padrão Free somente neste site. O proprietário pode ler seus valores no painel/API. Elas não têm prefixo `NEXT_PUBLIC`, não são armazenadas no Git e não foram impressas em chat/logs públicos. As chaves JWT e de criptografia são novas e exclusivas da prévia. Não se usaram credenciais de aplicação do ambiente existente.
5. **Binding nativo:** o pacote Neon traz bcrypt ARM64; Netlify executa x64. O empacotador de prévia usa o binding Linux x64 da mesma versão instalada do bcrypt, testando hashes existentes. O pacote Neon original foi preservado.
6. **Assets 404:** o adaptador Next.js gera os arquivos públicos em `.netlify/static`. Deploy manual sem build precisa desse diretório explicitamente. O resultado foi corrigido e os 21 testes remotos foram repetidos integralmente com sucesso.

## Custos e limites

Netlify: plano **Free** confirmado na conta; Neon: assinatura **free_v3** confirmada no projeto exclusivo. Nenhum cartão, contratação, upgrade ou cobrança foi habilitado. A disponibilidade depende das cotas; não é promessa de hospedagem ilimitada.

- Netlify Free: 300 créditos/mês compartilhados pela equipe; requisições, banda e execução consomem a cota. Deploys feitos como produção **deste site de teste** também consomem créditos de deploy. Esgotar a cota pode pausar projetos. Não foi habilitado recarregamento pago.
- Neon Free: cotas atuais de computação, armazenamento e transferência, com suspensão/reativação e possíveis partidas frias. Foram mantidos limites menores no projeto de revisão (0,25 CU e limites de uso do projeto), sem contratar capacidade adicional.
- Pagamentos e integrações reais estão desabilitados/sandbox. E-mails não são enviados. Uploads estão desabilitados nesta prévia; o armazenamento efêmero de funções não é solução de preservação dos arquivos antigos.
- A prévia é pública por autorização específica, com `X-Robots-Tag: noindex, nofollow, noarchive`. Essa diretiva não equivale a controle de acesso: use somente dados sintéticos e senhas exclusivas de teste.

Referências de condições consultadas: https://www.netlify.com/pricing/ e https://neon.com/pricing. Reconfirmar antes de criar novos recursos ou ampliar limites.

## Revisão pelo iPhone e Android

1. Abra https://sortex-fase1-review.netlify.app em Safari no iPhone ou Chrome no Android. Não precisa manter o Mac ligado para acessar esta prévia.
2. Abra `/cadastro/comprador`, depois `/cadastro/organizador`, alternando PF e PJ. Use apenas nomes, e-mails e documentos de teste com dígitos verificadores válidos; não use dados pessoais reais.
3. Na etapa endereço, selecione Bahia digitando `ba`; digite `Fe` na cidade e escolha Feira de Santana. Troque a UF e confira a limpeza da cidade. Confira rolagem, toque, orientação da tela e preenchimento com teclado móvel.
4. Conclua uma conta de teste com senha exclusiva e guarde-a em seu gerenciador de senhas. Não envie a senha no chat. Não reutilize as contas automáticas nem uma senha real. Se faltar um documento sintético válido, solicite uma fixture de teste ao responsável; não invente números de terceiros.
5. Entre com a conta de organizador criada; abra **Configurações → Perfil**, salve um slogan, recarregue e depois limpe-o. Confira persistência e mensagens de erro. O slogan não deve aparecer no cadastro inicial.
6. Não tente pagamentos reais, uploads ou recuperação dos dados antigos nesta prévia. Registre aparelho, versão do sistema/navegador e passos de qualquer erro, sem compartilhar credenciais ou dados pessoais.
7. Anote separadamente os resultados em Safari real e Android físico. Até essa revisão acontecer, eles continuam pendentes.

## Reproduzir e reverter com segurança

- Antes de comandos, conferir branch/status e o destino. Não usar `.env` do Mac, banco publicado ou credenciais antigas.
- `services/api/scripts/build-netlify-phase1-preview.cjs` prepara o runtime em checkout **novo** e recusa sobrescrever saída existente. Executar após `npm run build:neon` na API, mantendo seus artefatos fora do Git.
- O build Next usa `@netlify/plugin-nextjs`; o runtime fica em `.sortex-preview-runtime` fora do diretório público, incluído exclusivamente na função `sortex-api`. Manter o header de não indexação e as proteções do adaptador.
- O deploy manual deste resultado usou `NETLIFY_SITE_ID=af720ddb-9366-4e26-bcfe-d92ea8c27caf`, CLI autenticada e `netlify deploy --prod --no-build --dir .netlify/static` a partir de `apps/web` do checkout isolado. `--prod` aqui significa publicar no endereço principal **do novo site de teste**, não no site existente. Não executar esse comando com outro ID.
- Para os testes remotos: em `apps/web`, `npx playwright test --config playwright.preview-phase1.config.ts`. A configuração aceita só a URL da prévia; a pré-checagem exige API/banco prontos e assets válidos antes de mutações. As fixtures são cumulativas e sintéticas; não se faz reset para reexecutar.
- Para reverter esta revisão, interromper novos testes e republicar somente um deploy anterior do mesmo site de teste após verificar o ID. Mudanças de código usam revert em branch própria. Não apagar banco/tabelas, não reverter migrations por DROP e não apontar o site para o banco antigo.
- Dados reais antigos, uploads e validação Safari real continuam pendentes. Fase 2 e site institucional não foram iniciados; a referência visual recebida permanece para uma fase futura autorizada.
