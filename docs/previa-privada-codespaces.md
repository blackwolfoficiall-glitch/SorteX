# Prévia Web privada no GitHub Codespaces (sem Mac)

Alternativa temporária ao Netlify para **uma pessoa** validar o site no
Safari. Mantém o Next.js completo, a API Neon de homologação e o banco
isolado que o app usa. Não é hospedagem permanente, não instala o app iOS
e não modifica o site público. Nenhuma credencial Neon ou de pagamento é
necessária. Este roteiro não é uma prévia já publicada.

1. Entre com sua conta pessoal no GitHub e confira [uso e orçamento](https://github.com/settings/billing/overview).
   Prossiga somente dentro da [cota incluída](https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage),
   sem cobrança por excedente: conta sem forma de pagamento ou bloqueio
   efetivo de excedente em R$ 0. Se não puder confirmar, não crie.
2. Abra [Configurar Codespace da branch de homologação](https://codespaces.new/blackwolfoficiall-glitch/SorteX/tree/homologacao/web-ios-integrada).
   Confirme a conta que custeia o ambiente, a branch e a máquina padrão
   de 2 núcleos. Somente o criador consegue abrir a porta privada, mesmo
   que outro usuário tenha permissão no repositório.
3. Antes de servir o app, inicie no terminal do Codespace um canário local,
   sem dados, na porta `4408`: `node -e 'require("node:http").createServer((q,r)=>r.end("sortex-canary")).listen(4408,"127.0.0.1")'`.
   Em **Ports**, encaminhe **4408** e confirme **Visibility: Private**.
   Abra o endereço encaminhado no Safari logado na conta criadora e
   confirme `sortex-canary`. Sem conta/sessão GitHub (janela anônima, não
   apenas logout da SorteX), o mesmo link precisa bloquear ou pedir
   login, nunca devolver o canário. Não mude a visibilidade para resolver
   falha de autenticação. Encerre o canário com Ctrl+C e confira que a
   mesma porta continua privada; não inicie o app sem essa verificação.
4. Use Node 24. No terminal, a partir da raiz do repositório, fixe os dois
   SHAs completos de 40 caracteres confirmados pelo responsável pela QA e
   rode:

```bash
set -euo pipefail
WEB_SHA='PREENCHER_SHA_WEB_CONFIRMADO'
API_SHA='PREENCHER_SHA_API_CONFIRMADO'
[[ "$WEB_SHA" =~ ^[0-9a-f]{40}$ && "$API_SHA" =~ ^[0-9a-f]{40}$ ]]
test "${CODESPACES:-}" = true
test "$(git branch --show-current)" = homologacao/web-ios-integrada
test "$(git rev-parse HEAD)" = "$WEB_SHA"

api='https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech'
test "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:?}" = app.github.dev
origin="https://${CODESPACE_NAME:?}-4408.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
check_api() {
  curl --fail --silent --show-error --max-time 26 "$1/health" |
    node -e 'const h=JSON.parse(require("node:fs").readFileSync(0)); if(h.status!=="ok"||h.version!==process.argv[1])process.exit(1)' "$API_SHA" &&
  curl --fail --silent --show-error --max-time 26 "$1/health/ready" |
    node -e 'const r=JSON.parse(require("node:fs").readFileSync(0)); if(r.status!=="ready"||r.database!=="up")process.exit(1)'
}
check_api "$api"

cd apps/web
run_clean() {
  env -i PATH="$PATH" HOME="$HOME" CI=1 NEXT_TELEMETRY_DISABLED=1 \
    SORTEX_HOMOLOGATION_API_URL="$api" API_INTERNAL_URL="$api" API_URL="$api" \
    NEXT_PUBLIC_APP_URL="$origin" WEB_URL="$origin" OAUTH_WEB_ORIGIN="$origin" "$@"
}
# Instale também as dependências de build (Tailwind/shadcn); não use --omit=dev aqui.
run_clean npm ci --no-audit --no-fund
run_clean npm run build
run_clean timeout --signal=TERM --kill-after=10s 30m \
  node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4408
```

5. Antes de enviar o link, confirme no terminal local que
   `http://127.0.0.1:4408/api/health` informa o SHA da API e
   `/api/health/ready` está pronto com banco `up`. Pelo endereço hospedado
   confirme o bloqueio sem sessão para `/`, `/api/health/ready`,
   `/robots.txt`, um asset `/_next/static/…` e uma requisição POST sem
   dados de conta. No Safari autenticado, confirme o site, o mesmo SHA
   via BFF, login com dados sintéticos, abertura de campanha, navegação
   dinâmica e logout. Se qualquer teste falhar, pare a prévia e não
   compartilhe o link. O acesso do GitHub é separado do login da SorteX;
   login social, e-mail, PIX e instalação nativa não são validados aqui.
6. Encerre em até 30 minutos. Se terminar antes, use Ctrl+C e pare o
   ambiente em [Seus codespaces](https://github.com/codespaces).
   Parar encerra compute; arquivos retidos ainda contam para armazenamento.
   Se a cópia é descartável, exclua somente esse Codespace após confirmar
   que não há alterações a guardar.

Referências: [segurança e portas privadas](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces#port-forwarding),
[encaminhamento de porta](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace),
[variáveis do Codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace).
