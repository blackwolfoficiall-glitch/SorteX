# SorteX — escopo integrado da revisão

Branch: `feat/cadastro-identidades-institucional`. Base desta ampliação: `5ce6dda`.
Data: 14/11/2026, America/Bahia. Autorização: ampliar a revisão para institucional, acabamento de acesso e autenticação Google/Apple, somente na prévia e banco isolado. Não fazer merge nem alterar o ambiente existente. A entrega anterior da Fase 1 não conclui este conjunto.

## Lista completa de solicitações

| Solicitação | Estado antes da publicação desta ampliação |
| --- | --- |
| Preservar cadastro PF/PJ, documentos oficiais, endereços e transações da Fase 1 | Implementada e testada anteriormente; regressão desta ampliação ainda pendente |
| UF/cidade pesquisáveis, teclado, IBGE e contingência | Implementada e testada anteriormente; regressão desta ampliação ainda pendente |
| Correção de organizadores e slogan em Configurações → Perfil | Implementada e testada anteriormente; regressão desta ampliação ainda pendente |
| Nova inicial de produto, marca roxa e caminhos dos dois perfis | Implementada; validação publicada ainda pendente |
| Referência visual Nexo | Acessada e renderizada em 14/11/2026; organização visual examinada; sem copiar materiais |
| Demonstrações reais da interface | Capturas reais de teste integradas; revisão desktop/mobile local feita, capturas finais publicadas ainda pendentes |
| Recursos, como funciona, diferenciais e sobre | Implementada; validação final na prévia ainda pendente, somente recursos comprovados |
| Planos sem preços/condições fictícios | Implementada; estrutura informativa sem contratação. Preços/benefícios aprovados ainda pendentes |
| FAQ, contato e políticas | Implementada; links reais preservados. Canal público definitivo ainda pendente |
| SEO: metadados, Open Graph, sitemap, robots, URLs e dados estruturados | Implementada; prévia continuará não indexável, validação publicada ainda pendente |
| Redesenho de login/cadastro, PF/PJ, etapas, erros e loading | Implementada; validação publicada ainda pendente |
| Email e senha e checkout simplificado preservados | Implementados anteriormente; regressão desta ampliação ainda pendente |
| Google OIDC completo com sessão SorteX | Implementada com configuração/validação externa pendente; solicitada ao proprietário |
| Apple OIDC completo, incluindo e-mail privado | Implementada com configuração/validação externa pendente; acesso Developer/credenciais não comprovados |
| Complementação de perfil após acesso social | Implementada; validação publicada ainda pendente |
| Vínculo explícito, sem união por coincidência de email | Implementada; validação publicada ainda pendente |
| Preservar IDs, contas, permissões, sessões e unicidade | Implementada e testada: migration exclusiva da prévia; checksums de contas/sessões/perfis/consentimentos/auditoria e histórico anterior inalterados |
| Documentação oficial atual dos provedores | Consultados documentos oficiais e discovery OIDC em 14/11/2026 |
| Testes HTTP/banco, segurança OIDC e fluxos completos | Implementada e testada: 272 unitários e 15 HTTP sociais no PostgreSQL local isolado; regressão publicada ainda pendente |
| Revisão mobile e capturas de novas telas | Ainda pendente; Safari real e Android físico não executados |
| Publicar só a prévia e entregar links | Ainda pendente desta ampliação |
| Orçamento R$ 0; nenhuma cobrança/cartão | Restrição mantida; não contratar Apple Developer caso não exista acesso habilitado/isento |
| Dados reais antigos e uploads do Mac | Ainda pendente de acesso/backup; esta revisão não representa restauração |

## Decisões desta ampliação

- Preservar NestJS, Prisma, PostgreSQL, Next.js e JWT/refresh existentes. Identidades externas por `provider + subject`, vinculadas ao mesmo `User.id`.
- Duas tabelas novas; nenhuma reclassificação ou alteração de senha das contas existentes. Contas sociais novas recebem um hash de senha aleatória desconhecida, preservando a coluna obrigatória atual; a identidade externa produz sessões internas pelo mesmo mecanismo JWT.
- Google usa authorization code + PKCE S256; Apple usa code e callback `form_post`, conforme discovery oficial, sem alegar PKCE onde o provedor não o anuncia.
- State de uso único persistido, nonce, validade curta, vínculo ao navegador e tokens em cookies HttpOnly. Nenhum segredo no frontend.
- E-mail coincidente exige acesso autenticado recente à conta existente e confirmação explícita. Não promover papel nem criar ADMIN por login social.
- Não considerar integração externa concluída por fixture, mock ou botão. Testes automatizados usam chaves/identidades sintéticas apenas no teste. Publicação permanece sem atalhos de autenticação.
- Google precisa de cliente Web e consentimento no console oficial. Apple depende de configuração de App ID/Services ID/return URL/chave privada e conta habilitada. Não criar inscrição paga.

Esta lista será atualizada com evidências e bloqueios reais ao terminar a implementação acessível.
