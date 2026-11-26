# Prévia privada da SorteX no Mac

O iniciador não instala ferramentas, não usa cartão/conta Cloudflare e não modifica o checkout atual. Requer macOS, Git, npm com Node 22+ (recomendado 24 ou 26), cloudflared oficial 2026.11.2+ com a opção `--allowed-mail`, conexão ao GitHub/npm/Neon e a [saída 7844](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/) para o Cloudflare Tunnel. Se cloudflared ainda não estiver instalado, use o [instalador oficial](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) ou, se já usar Homebrew, `brew install cloudflared`; confira o suporte ao PIN com `cloudflared tunnel --help`. Não rode túnel sem PIN.

Com a API isolada e saudável e as revisões verificadas pela equipe, no Mac:

```sh
node .github/qa/sortex-pin-preview.mjs <SHA completo da branch web> <SHA completo da API publicada>
```

O script verifica o par API/banco de teste, usa um clone temporário exclusivo da branch candidata, solicita somente seu e-mail localmente, e abre o túnel com PIN incluindo um único destinatário. Primeiro testa o bloqueio de acessos anônimos com um canário 503 que nunca serve o app. Depois só imprime o endereço HTTPS se o Next privado e o BFF estiverem saudáveis, usando a mesma revisão da API. O código recebido vai **apenas na tela oficial da Cloudflare**. Nunca cole aqui senha, PIN, token ou credenciais do Neon. Ctrl+C encerra o túnel e o aplicativo; o link também expira em até 30 min desta sessão. Mantenha o Mac ligado e conectado. O host muda a cada execução.

Não é uma publicação na Netlify ou em produção, não serve integração webhooks, e não permite clientes automáticos passar pelo PIN. A camada privada protege o frontend; o app nativo e os webhooks continuam usando diretamente o endereço de QA do Neon. Use somente contas e documentos sintéticos e não faça pagamentos. Se o site mostrar erro, não abra outra porta nem use um túnel público de contingência.

Por trás do PIN, cookies web ficam no host temporário; espere um novo login se o endereço mudar. A origem em build/runtime é alinhada para o frontend; o backend Neon pode ainda referenciar a URL de QA canônica em CORS, OAuth, recuperação de senha e callbacks. Eles precisam de teste separado e não são declarados aprovados. Recursos que exigem SSE também não servem para o Quick Tunnel.

[Como funciona a autenticação do Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#restrict-access-by-email) · [Release confirmado do cloudflared](https://github.com/cloudflare/cloudflared/releases/tag/2026.11.2)

Validação já executada sem rede: `node --check sortex-pin-preview.mjs` e `node --test sortex-pin-preview.test.mjs` (5 testes). O script impediu a execução no Linux. Não foi executado no Mac e nenhum endereço de túnel foi criado.
