# Motor de sorteios da SorteX

## Escopo e segurança

O Módulo 6 é determinístico: a mesma regra versionada e os mesmos cinco prêmios sempre produzem o mesmo resultado. Ele não usa aleatoriedade, não consulta a internet e não executa sorteios de produção automaticamente. Resultados são cadastrados manualmente, revisados por `ADMIN` e somente estados `VERIFIED` ou `LOCKED` podem alimentar uma execução.

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

1. Administrador cadastra a extração e revisa os cinco prêmios.
2. Organizador simula a regra; simulação nunca persiste ganhador.
3. `execute` valida campanha, data, encerramento de vendas, extração e snapshot publicado; cria uma prévia `PENDING_CONFIRMATION`.
4. `confirm` revalida o título `SOLD`, cria o ganhador e altera a campanha para `DRAWN` em transação.
5. A página pública exibe apenas dados autorizados, regra, etapas, resultado e hash.

## Cotas premiadas

Após confirmação válida de pagamento, o detector compara somente títulos `SOLD` com cotas de número exato. A restrição composta impede duplicação. Regras de geração de cotas ficam para uma evolução posterior.

## Auditoria e hash

Eventos relevantes são registrados em `AuditLog`. O hash SHA-256 usa JSON canônico, snapshots, ticket, horário e a versão `sortex-draw-v1`. Ele é prova de integridade interna, não blockchain e não comprova sozinho a autenticidade da fonte externa.

## Privacidade

A verificação pública nunca retorna CPF, telefone, e-mail, documentos ou comprovantes sensíveis. Depoimentos e mídia aparecem apenas com autorização pública do ganhador.

## Integração futura

`LotteryResultsProvider` define a fronteira para uma futura fonte oficial. O provider manual atual lança erro para consultas externas. Pagamento automático do prêmio, notificações, renderização final de vídeo e integração oficial estão fora deste módulo.
