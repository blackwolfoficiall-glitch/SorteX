# Motor de sorteios da SorteX

## Escopo e segurança

O Módulo 6 é determinístico: a mesma regra versionada e os mesmos cinco prêmios sempre produzem o mesmo resultado. O motor não usa aleatoriedade, não consulta a internet e não executa sorteios de produção automaticamente. Resultados são cadastrados manualmente ou importados para revisão por `ADMIN` e somente estados `VERIFIED` ou `LOCKED` podem alimentar uma execução.

## Formato de regra

```json
{
  "version": 1,
  "outputLength": 5,
  "steps": [
    { "order": 1, "sourcePrize": 1, "digitPosition": "UNIT", "direction": "NORMAL" }
  ],
  "normalization": { "mode": "MODULO_TOTAL_NUMBERS" }
}
```

Cada etapa aponta para um dos cinco prêmios e uma posição (`TEN_THOUSAND`, `THOUSAND`, `HUNDRED`, `TEN`, `UNIT`). A direção pode ser normal ou inversa; `COMPLEMENT_9` é a transformação inicial suportada.

## Normalização

- `MODULO_TOTAL_NUMBERS`: resultado módulo quantidade total.
- `LAST_N_DIGITS`: usa os últimos dígitos e garante o intervalo.
- `PAD_LEFT_ZERO`: preserva a largura com zeros.
- `REJECT_OUT_OF_RANGE`: exige resultado já válido.
- `CUSTOM_PIPELINE`: reservado; rejeita enquanto não houver operações publicadas.

A normalização integra o snapshot público da regra. A política padrão para número não vendido é `MANUAL_REVIEW`; outras políticas somente são usadas quando publicadas antes do sorteio.

## Fluxo

1. Administrador cadastra ou importa a extração e revisa os cinco prêmios.
2. Organizador simula a regra; simulação nunca persiste ganhador.
3. `execute` valida campanha, data, encerramento de vendas, extração e snapshot publicado; cria uma prévia `PENDING_CONFIRMATION`.
4. `confirm` revalida o título `SOLD`, cria o ganhador e altera a campanha para `DRAWN` em transação.
5. A página pública exibe apenas dados autorizados, regra, etapas, resultado e hash.

## Cotas premiadas

Após confirmação válida de pagamento, o detector compara somente títulos `SOLD` com cotas de número exato. A restrição composta impede duplicação. Regras de geração de cotas ficam para uma evolução posterior.

## Auditoria e hash

Eventos relevantes são registrados em `AuditLog`. Novas apurações usam
`sortex-draw-v2`. O SHA-256 incorpora os identificadores da campanha e extração,
a regra e o resultado registrados (incluindo o ID do título e os dados de
origem quando presentes), os números de saída e o mesmo `executedAt` gravado
no banco. O JSON é normalizado primeiro; datas entram em ISO e chaves de
objetos são ordenadas sem depender do idioma do servidor. O replay lê apenas
o registro persistido e não requer consultar novamente a CAIXA.

A confirmação confere o hash antes de criar um ganhador. Apurações antigas
continuam sem versão gravada; seus hashes não são recalculados ou tratados
como verificáveis retroativamente. O v1 usava um horário separado que não foi
gravado como parte da entrada do hash. Isso é controle de consistência interna,
não assinatura digital, blockchain ou comprovação de autenticidade da fonte.

## Privacidade

A verificação pública nunca retorna CPF, telefone, e-mail, documentos ou comprovantes sensíveis. Depoimentos e mídia aparecem apenas com autorização pública do ganhador. Ao invalidar uma apuração, o código deixa de exibir prova pública; a apuração, o ganhador e o motivo da invalidação permanecem auditáveis internamente. O endpoint não permite cache da prova.

## Integração futura

Pagamento automático do prêmio, notificações, renderização final de vídeo e captura agendada estão fora deste módulo.

## Importação administrativa da CAIXA em homologação

A página `/admin/loteria` (permissão `LOTTERY_RESULTS_WRITE`) pode consultar uma
extração por número no [serviço da CAIXA](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6091).
O backend exige `CAIXA_FEDERAL_IMPORT_ENABLED=true`, desabilitado por padrão.
Aplique a migração `20261125152000_caixa_federal_source_prizes` somente no banco
isolado de homologação antes de habilitar a opção. Não há captura agendada,
publicação de ganhadores nem utilização de campanhas reais. Em caso de falha ou
mudança do contrato da fonte, use o cadastro manual e revise o resultado.

O formato foi conferido na fonte oficial nos concursos
[6091](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6091),
[6109](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6109),
[6110](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6110) e
[6111](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/6111), e
comparado com a apresentação de números de cinco dígitos no
[Portal Loterias CAIXA](https://loterias.caixa.gov.br/Paginas/Federal.aspx).
O adaptador aceita cinco dígitos canônicos ou seis dígitos com exatamente um
zero de preenchimento removível na primeira posição. Exemplo: `000091`
é armazenado como valor original e o motor recebe `00091`. Valores de largura
ou formato desconhecidos são rejeitados em vez de truncados.

A importação grava a URL da fonte, o SHA-256 da resposta e a lista original,
junto com os cinco valores canônicos. Log e registro são atômicos. A extração
entra como `PENDING_REVIEW`, não pode ser alterada manualmente e não substitui
automaticamente um concurso já cadastrado. O administrador justifica a
verificação antes de bloquear a extração. O snapshot de apuração incorpora os
originais e o hash da fonte para novas extrações importadas; não altera snapshots
anteriores.
