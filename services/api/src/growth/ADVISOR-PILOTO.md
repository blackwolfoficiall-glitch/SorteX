# SorteX Advisor: piloto de modelo externo

O endpoint existente `POST /ai-sortex/advisor/chat` continua protegido pelo papel Organizador e mantém a resposta de regras locais (`mode: DETERMINISTIC`) quando o piloto estiver desativado, não autorizado, não se aplicar à pergunta ou tiver erro. As demais operações do módulo continuam internas e não chamam o provedor. A aplicação não interpreta nem executa ações sugeridas pelo modelo. Links e evidências já existentes são produzidos localmente.

## Escopo e ativação

O adaptador OpenAI usa a [Responses API oficial](https://developers.openai.com/api/reference/resources/responses/methods/create). Uma chamada pode ocorrer somente se todos os requisitos forem atendidos:

- `APP_ENV=staging`, `INTEGRATIONS_MODE=sandbox` e `FEATURE_REAL_PAYMENTS=false`.
- `SORTEX_ADVISOR_PROVIDER=openai`, `SORTEX_ADVISOR_PILOT_BUDGET=approved` e `SORTEX_ADVISOR_PILOT_ORGANIZER_ID` identificando um organizador ativo e fictício (`@example.test`).
- `OPENAI_API_KEY` via cofre do backend, não via cliente ou Git, e `OPENAI_MODEL` apontando para um modelo validado para Structured Outputs, sem valor padrão.
- Consentimento para esta ação via `allowAi: true` (booleano) na requisição autenticada. O frontend atual não envia esse campo; uma chamada normal não consome créditos.
- Uma pergunta de resumo, recuperação de reservas ou promoções dentre as frases reconhecidas. O texto digitado nunca é enviado: apenas um código de assunto e oito métricas numéricas da conta autenticada. Não há nome, e-mail, documento, identificador de usuário/campanha, URL, lista de contatos, histórico ou dados de clientes no corpo externo.

O transporte não segue redirecionamentos, não habilita ferramentas, não repete solicitações e usa `store: false`, que não equivale a retenção zero. Não se devolve erro bruto nem se registra texto do provedor. Há timeout, teto de saída de 512 tokens e limite por instância de uma chamada concorrente e dez tentativas. Esse limite reinicia com o processo e não substitui orçamento ou cota durável para infraestrutura distribuída.

## O que ainda não está liberado

Não assuma custo zero por haver assinatura ChatGPT ou chave API. Antes de habilitar, comprovem um projeto dedicado com saldo/cota autorizados, verifiquem a política de retenção do plano e bloqueiem gasto além da autorização no provedor. O piloto atual foi testado apenas com transporte de teste e não foi publicado nem chamou modelo externo. Provedores novos devem implementar o contrato do adaptador; Gemini e Claude não estão configurados.

A [Gemini Developer API](https://ai.google.dev/gemini-api/docs/pricing) lista modelos e cotas gratuitas, mas informa uso distinto de dados no nível gratuito; avaliar somente com conteúdo sintético. [Claude](https://platform.claude.com/docs/en/about-claude/pricing) publica preços por tokens e deve ser considerado somente com créditos ou orçamento expressamente aprovados. Para [OpenAI](https://developers.openai.com/api/docs/pricing), conferir preço do modelo e créditos do projeto antes de escolher.

Pendente: fluxo transparente de opt-in no app/site, histórico com isolamento e política de exclusão, limites e auditoria persistentes, integração real encaixada no orçamento, análise de período/tendência e acesso aos módulos via agregações explicitamente autorizadas. Nenhuma configuração altera campanhas ou orçamentos nem permite envio de mensagens. Qualquer expansão do piloto exige revisão de proteção de dados.
