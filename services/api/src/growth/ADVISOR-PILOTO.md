# SorteX Advisor: piloto de modelo externo

`POST /ai-sortex/advisor/chat` é restrito ao papel Organizador. Sem elegibilidade, autorização por requisição, assunto reconhecido ou resposta externa válida, mantém o motor local com `mode: DETERMINISTIC`. Somente respostas válidas do provedor configurado recebem `mode: GEMINI` ou `mode: OPENAI`. O Advisor não executa campanhas, orçamento, cobrança, anúncios, mensagens nem outra alteração na conta.

## Origem de dados e consentimento

- As permissões exigem homologação explícita em sandbox, sem pagamentos reais e um organizador de teste ativo e precisamente identificado. A credencial fica somente no backend. As exigências comuns e específicas de Gemini estão descritas em [ADVISOR-GEMINI-TRANSPORT.md](./ADVISOR-GEMINI-TRANSPORT.md).
- O provedor recebe somente um assunto fixo reconhecido e agregados do lote sintético `sortex-review-v1`. Não recebe a pergunta digitada, nomes, e-mails, documentos, IDs, contatos, títulos, URLs ou dados operacionais. Se forem incluídas outras palavras na pergunta, não há envio.
- Confirmar o organizador não comprova que todo seu banco é fictício. O resolvedor exige o registro de auditoria autêntico do lote para esse organizador, três campanhas exatas não públicas com as marcações da avaliação e pedidos históricos sem relação de pagamento. Pedidos e promoções de aparência semelhante, linhas arbitrárias do mesmo organizador e registros de outras contas ficam fora. Divergência nas marcações ou nos pedidos exatos bloqueia o envio.
- Financeiro, CRM e atribuição de Ads ficam explicitamente indisponíveis no contexto externo porque o lote não traz fontes validadas desses módulos. Indisponível não é zero. O Advisor determinístico e as áreas internas continuam utilizando os dados autorizados da própria conta.
- A chamada autenticada precisa enviar `allowAi: true` em cada pedido. Habilitar as chaves no backend não concede consentimento em nome de um usuário.

## Consumo, privacidade e validação

A API prepara corpo JSON limitado e reserva consumo de forma atômica no PostgreSQL por data UTC, tanto para o organizador quanto para a operação inteira. Uma reserva já efetuada não é devolvida por indisponibilidade externa. Se a reserva falhar, não há chamado ao provedor. A quota usa unidades conservadoras e não representa uma medição de cobrança. Tornar a tabela disponível é pré-requisito de implantação.

Conferir no console o projeto isolado, plano, créditos autorizados, política de retenção e restrições da chave antes de habilitar. Não assumir custo zero por haver assinatura ChatGPT, Gemini ou Claude. Defesa de transporte, autenticação, origem e quota são verificáveis localmente com PostgreSQL descartável e apenas o transporte substituído, sem comprovar acesso ao provedor, faturamento ou resposta de modelo real.

Permanecem pendentes a chamada real de homologação, histórico com isolamento e política de exclusão, períodos/tendências e expansão para quaisquer fontes reais. O plano gratuito do Gemini não é destinado a dados sensíveis, pessoais ou confidenciais.
