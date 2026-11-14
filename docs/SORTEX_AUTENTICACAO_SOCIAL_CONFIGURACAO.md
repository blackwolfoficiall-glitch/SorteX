# SorteX — configuração e limites da autenticação social

Escopo: somente `sortex-fase1-review`, branch Git `feat/cadastro-identidades-institucional`. Não usar banco, segredos ou recursos do ambiente `sortex-homologacao`.

## Estado real

Os fluxos de authorization code, verificação OIDC, complementação, vínculo explícito e emissão das sessões SorteX foram implementados. Os testes HTTP usam tokens assinados e provedores simulados **apenas dentro da suíte isolada**, com PostgreSQL real. Isso não certifica acesso com uma conta Google/Apple real.

Até existirem credenciais/configuração externa válidas e o percurso real ser executado, ambos os provedores permanecem **implementados com configuração/validação externa pendente**. Os botões desabilitados informam essa condição. Não existe login simulado nem atalho de teste na API publicada.

## Google — ação do proprietário, sem valores no chat

1. Abrir https://console.cloud.google.com/auth/clients no projeto Google desejado, sem ativar faturamento. Usar **Google Auth Platform**, cliente **Aplicativo da Web**. Não é necessário contratar Identity Platform ou serviços pagos.
2. Configurar marca/consentimento, público e escopos mínimos `openid`, `email` e `profile`. Se o aplicativo estiver em Testing, adicionar as contas que vão testar como usuários de teste. Não anunciar acesso público irrestrito antes da validação aplicável do Google.
3. Origem JavaScript autorizada: `https://sortex-fase1-review.netlify.app`.
4. URI de redirecionamento autorizado, exato: `https://sortex-fase1-review.netlify.app/api/auth/social/google/callback`.
5. Em https://app.netlify.com/projects/sortex-fase1-review/configuration/env, criar `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`, somente nesse projeto de teste. Não usar prefixo `NEXT_PUBLIC` nem criar arquivos no Git.
6. O Netlify Free usado nesta prévia aceita variáveis padrão; o proprietário pode ler os valores no painel/API. Esse modo foi autorizado explicitamente. Não desabilitar secret scanning nem trocar de plano para configurar scopes granulares.
7. Informar apenas que a configuração foi concluída. Replicar o deploy exclusivamente da prévia para carregar as variáveis e testar entrada, novo comprador/PF/PJ e retorno à conta existente.

Se o console exigir cobrança/cartão ou uma autorização de organização indisponível, interromper essa ação e registrar o bloqueio; não habilitar faturamento.

## Apple — primeiro confirmar uma conta elegível já existente

O portal oficial informa **US$ 99 por ano** para a associação padrão Apple Developer Program, com possíveis isenções para organizações elegíveis. Não foi comprovado acesso habilitado ou isenção do proprietário. **Não fazer inscrição, renovação paga ou compra.** Sem acesso existente/isento que permita configurar Sign in with Apple para web, o orçamento R$ 0 bloqueia a habilitação externa da Apple.

Se já houver acesso válido, sem custo adicional:

1. Abrir https://developer.apple.com/account/resources/identifiers/list. Usar identificadores e chave **exclusivos de teste**; não alterar App IDs ou Services IDs de aplicativos existentes em produção.
2. Configurar um App ID primário com a capacidade Sign in with Apple e um Services ID web associado, conforme o portal permitir à conta. Isso é configuração de identificação do provedor; não inclui desenvolver aplicativo mobile.
3. Na configuração web do Services ID, cadastrar domínio/subdomínio `sortex-fase1-review.netlify.app` e Return URL exato `https://sortex-fase1-review.netlify.app/api/auth/social/apple/callback`. Se houver verificação de domínio, disponibilizar somente o arquivo oficial público de associação neste site de teste.
4. Criar uma chave Sign in with Apple associada ao App ID de teste. Guardar o arquivo `.p8` em armazenamento seguro próprio, nunca no repositório ou chat. A Apple só disponibiliza o download da chave privada na criação.
5. Somente no projeto Netlify da prévia, configurar `APPLE_OAUTH_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` (PEM completo; aceita quebras de linha reais ou `\n`). Não usar prefixo `NEXT_PUBLIC`.
6. O servidor gera um client secret ES256 de cinco minutos durante a troca do código; ele não é distribuído ao navegador. O provedor assina o ID token com RS256, validado via JWKS oficial.
7. Conferir cadastro normal e **Ocultar meu e-mail**, retorno em Safari real e acesso novamente sem reenviar nome. Se forem necessários envios de e-mail para relay, configurar os remetentes na Apple antes de anunciar essa entrega; e-mails estão desabilitados nesta prévia.

Se qualquer etapa exigir novo pagamento, parar essa configuração. Google e e-mail continuam alternativas independentes, sem simular a Apple funcional.

## Contrato e decisões de segurança

- Google: authorization code + PKCE S256, `state` persistido de uso único e `nonce`. Apple: authorization code, `nonce` e callback `form_post`, conforme discovery oficial; não se anuncia PKCE no fluxo Apple que não o suporta.
- Callback BFF guarda provas e sessões em cookies HttpOnly com prefixo `__Host-` em produção, para impedir fixação por domínio/subdomínio; o cookie de vinculação ao navegador usa Secure/SameSite=None em HTTPS para o retorno POST da Apple. Cookies de sessão SorteX mantêm suas opções anteriores.
- O backend valida assinatura, chave, algoritmo, emissor, destinatário, validade, nonce e subject. Só usa e-mail verificado para abrir um cadastro novo. Tokens de acesso/refresh dos provedores não são armazenados.
- A identidade está em `SocialIdentity`, com unicidade `(provider, subject)` e `(userId, provider)`. O e-mail de uma identidade nunca substitui automaticamente o e-mail da conta SorteX.
- Coincidência de e-mail abre uma confirmação de vínculo, não uma fusão de contas. O vínculo requer sessão SorteX autenticada há no máximo dez minutos e confirmação explícita. Também é possível escolher vincular quando o e-mail do provedor é diferente.
- Nova conta social pede o perfil Comprador/Organizador e, se necessário, PF/PJ. Reutiliza validações e persistência transacional da Fase 1. Nome disponível é pré-preenchido; e-mail verificado é mostrado sem pedir digitação; não se solicita senha nova.
- Apple pode fornecer o nome apenas no primeiro retorno, fora do ID token. Esse nome é somente sugestão editável; nunca comprova identidade ou e-mail. O e-mail privado é preservado como fornecido no token verificado.
- Campos e senhas de usuários existentes não foram alterados. Uma conta social nova recebe hash de uma senha aleatória desconhecida, mantendo o schema existente; definição posterior de senha depende do fluxo de recuperação e de e-mail habilitado. Não existe senha derivada do ID do provedor.
- As sessões internas usam os JWT/refresh existentes e os guards continuam verificando conta/sessão ativa. Não se concede ADMIN nem se contornam desativação, bloqueio ou redefinição obrigatória por acesso social.
- Desafios expiram em dez minutos e tickets de cadastro em quinze. Ao iniciar novo fluxo, material transitório expirado é limpo, mantendo o envelope de auditoria. Expiração é aplicada mesmo antes dessa limpeza oportunista.
- A migration `20261114140000_social_identities` cria apenas duas tabelas e índices/FK. Não muda IDs, passwords, AuthSession, papéis ou dados legados. Não há reset, backfill obrigatório ou migração no banco do ambiente existente.

## Fontes oficiais conferidas em 14/11/2026

- https://developers.google.com/identity/openid-connect/openid-connect
- https://accounts.google.com/.well-known/openid-configuration
- https://developer.apple.com/documentation/signinwithapplerestapi
- https://appleid.apple.com/.well-known/openid-configuration
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
- https://developer.apple.com/programs/enroll/

Pendências de validação externa, conta Apple, contato público definitivo, condições comerciais e Safari real continuam no escopo integrado. A implementação de uma parte não conclui o conjunto.
