# Bloqueios priorizados • SorteX

| Ordem | Prioridade | Evidência e impacto | Critério de fechamento |
|---|---|---|---|
| 1 | P0 | O cliente nativo usa a API fase1-review. O portal carrega sortex-homologacao. O mesmo comprador sintético obteve HTTP 201 na revisão, com o mesmo ID, e 401 no login do site. Ambos os serviços responderam ready. | Configurar uma base comum de teste; provar cadastro web → login iOS → edição/releitura sob o mesmo ID. Validar que o instalável usa essa revisão. |
| 2 | P0 | O portal é uma página de links e a WebView é incognito. O token do SecureStore não inicia a sessão web. As alterações do botão e da dependência nativa estão no diretório de trabalho. | Candidato versionado, sessão correta em cada canal, sem conta residual; instalar build compatível com WebView no iPhone e abrir três áreas autenticadas. |
| 3 | P0 | Compra, seleção de cotas e checkout não têm ação nativa no app inspecionado. A lista de pedidos é de leitura. O editor de campanha do organizador depende do portal. | Completar cenários 2 e 4 usando a UI do telefone e validar no site com os mesmos IDs. |
| 4 | P0 | Mercado Pago é o único adaptador identificado. Os testes simulam o provedor e webhooks. Os oito testes concorrentes cobrem reserva, não liquidação. | Evento real de sandbox, reentrega, expiração e conciliação com um crédito e uma baixa do título. |
| 5 | P0 | Login administrativo e a rota usada pela interface, /api/admin/platform/dashboard, retornaram 200 no BFF local. Um caminho alternativo de rewrite retornou 500 ao combinar destinos diferentes no build e no runtime. Falta aceite das permissões no ambiente candidato. | Alinhar configurações, repetir leitura e escrita por papel na candidata e conferir o log. |
| 6 | P0 | O provedor da Federal é manual. A fonte oficial examinada envia seis caracteres; o motor exige cinco. Um replay normalizado passa, mas falta o ciclo de publicação e a prova de imutabilidade. | Validar convenção de entrada por extração, regra versionada, ganhador e histórico nos dois clientes. |
| 7 | P0 | JS exportado para iOS; sem build assinado, execução em simulador ou teste de hardware nesta auditoria. | Arquivo de build de desenvolvimento, revisão registrada e aceite no dispositivo. |
| 8 | P1 | Falhas de regressão web, inclusive ordem de premiações. Algumas verificações dependem de conta, estado de onboarding e cookies. | Reproduzir cada falha com fixture controlada, atribuir causa e repetir a suíte. |
| 9 | P1 | A revisão do app reportou storage not-initialized; no Neon QA atual uploads ficam desligados até haver armazenamento privado durável. Upload e leitura de documento privado, isolamento e persistência após reiniciar a API passaram localmente. Ainda não há restauração ponta a ponta nem evidência de entrega de notificações externas. | Upload/leitura/remoção e restauração isolada de banco + objeto; recibo de entrega por canal. |
| 10 | P1 | Google e Apple indisponíveis na UI nativa; os testes OIDC usam provedor simulado. Controles de taxa são por processo. | Testar callbacks no aparelho e observar limites entre instâncias, retenção e auditoria sanitizada. |

P2 abrange refinamentos de comunicação e funções secundárias com o núcleo já estável. P3 cobre transmissão Live e novos adaptadores fora do escopo da correção inicial. Se um deles integrar o critério de lançamento comercial, deve ser reclassificado antes do aceite.

## Atualização da execução em 25/11

- P0 do item 1: integração comprovada em HTTP local. Continua aberto para candidata hospedada, confirmação de alvos de build/runtime, banco lógico e execução no iPhone.
- P0 adicional: o Mac com os commits ainda não publicados e o diff da WebView não está acessível a esta sessão. Preservar antes de editar os arquivos afetados na candidata.
