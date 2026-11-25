# Plano de homologação integrada • 25 a 30 de novembro de 2026

**Decisão de 25/11: manter em homologação interna.** A meta de segunda-feira, 30/11, é obter um veredito rastreável sobre o fluxo mínimo. O responsável técnico precisa congelar a revisão candidata, identificar a configuração efetiva do BFF e registrar o build instalado no telefone. Novas funções e publicação pública ficam para decisão posterior.

| Data (Bahia) | Responsável sugerido | Trabalho prioritário | Evidência exigida para encerrar |
|---|---|---|---|
| Qua 25/11 | Web/API + mobile | Preservar os dois commits locais e o diff da WebView; confrontar domínios e revisão implantada; aprovar ambiente único de testes. | SHAs da candidatura, hash do patch, versão das migrações, origem de cada cliente e duas contas de teste reconhecidas com o mesmo ID. |
| Qui 26/11 | Web/API + mobile | Ajustar o destino de homologação, inclusive rewrites resolvidos no build do Next. Decidir se o portal terá login explícito separado ou sessão integrada. Corrigir contrato e sessão antes dos módulos. | Cadastro web e login no iPhone; logout, expiração e troca de organizador; consulta de campanha sem dados de outra conta. |
| Sex 27/11 | Mobile + QA | Gerar build de desenvolvimento com WebView no Mac, testar no simulador e depois no aparelho. Ligar criação/edição ao editor existente e reserva/checkout do comprador à API. Corrigir falhas reproduzíveis do navegador. | Identificação do binário, três registros com ID correlacionado (conta, campanha e pedido); edição no telefone exibida no site; recuperação após falha de rede. |
| Sáb 28/11 | API financeira + QA | Executar ciclo Mercado Pago integralmente em sandbox, aprovar via notificação verificável, repetir evento, validar expiração, cancelamento, concorrência, divergência e conciliação. | ID de teste do pagamento, evento e compra; um único lançamento e um único título por número; relatório com valores antes/depois em ambos os canais. |
| Dom 29/11 | API + operação + QA | Reproduzir resultado histórico em campanha sintética. Revisar permissões, ganhadores, trilha imutável, dados pessoais e restauração de banco e mídia. | Regra publicada, versão/hash, extração, títulos elegíveis, ganhador nos dois canais e relatório de restauração isolada. |
| Seg 30/11 | Responsável pela homologação | Reexecutar P0 e regressões P1 na mesma revisão; registrar aprovados, reprovados e pendentes. | Nove cenários com ambiente, atores, data e resultado. Emitir decisão de homologação técnica ou adiar com bloqueio e responsável. |

## Roteiro de aceite integrado

Usar organizadores sintéticos A e B, um comprador e um administrador de teste. Registrar horário, versão dos clientes, SHA da API, identificador lógico do banco e protocolo de cada ação. Guardar evidência sanitizada. Toda interação financeira deve usar o provedor de testes.

| # | Operação | Critério objetivo |
|---|---|---|
| 1 | Criar campanha no site com A e abrir a lista no iPhone como A | Mesmo ID, preço, quantidade, estado e data. Repetir após fechar e reabrir. |
| 2 | Editar no iPhone e recarregar no site | O mesmo ID recebe o novo título/valor permitido; registrar persistência e trilha. |
| 3 | Criar conta no site; entrar no telefone | Mesmo ID e papel. Repetir com comprador, organizador PF e PJ; validar renovação e logout. |
| 4 | Reservar e iniciar compra pelo iPhone | Site exibe mesmo pedido, números, proprietário, vencimento e valor calculado pelo servidor. |
| 5 | Confirmar pagamento sandbox e receber webhook | Evento assinado reflete nos dois clientes; reentrega mantém pagamento, saldo e títulos únicos. |
| 6 | Consultar títulos, ganhador e financeiro | Bater números, ID do resultado, valor bruto, taxa e líquido com extrato persistido; o comprador só vê os seus dados. |
| 7 | Duas compras simultâneas da mesma cota | Uma reserva vigente e uma venda após aprovação, nenhuma cobrança órfã; expiração e retry consistentes. |
| 8 | Separar A e B | Cada organizador só lista/edita seus dados; política aplicada na API para leitura e escrita; repetir depois de trocar a conta no portal. |
| 9 | Administração web e restrição móvel | Matriz de papéis aplicada na API; aprovar/rejeitar com motivo e log, revogar sessão; cliente nativo bloqueia administrador conforme contrato atual. |

## Estimativa e dependências

Estimativa de planejamento para o núcleo existente: 5–10 dias úteis de calendário com uma pessoa em web/API, uma em iOS e apoio de QA, trabalhando em paralelo. Pressupõe Mac com assinatura de desenvolvimento, aparelho acessível, credenciais sandbox válidas e acesso às configurações dos dois ambientes desde o primeiro dia. A proposta de 26–30 inclui fim de semana e depende de disponibilidade da equipe. De 25 até 30 há quatro dias úteis incluindo as duas pontas. Uma única pessoa, um gateway indisponível ou uma nova integração nativa aumenta o prazo. As durações da matriz se sobrepõem e representam triagem/validação, não compromisso de implementação.

Reservar a janela seguinte para regressões, recuperação de backup e divergências encontradas. Integrações sem adaptador, transmissão ao vivo e homologação de novos gateways precisam de estimativa própria. Atraso em dependência P0 mantém o cenário pendente e impede o aceite integrado.
