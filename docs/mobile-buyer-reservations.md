# SorteX iOS: reserva sem cobrança

`apps/mobile/src/buyer/` adiciona componentes nativos ao checkout inicial. Ele
consulta a campanha e o inventário publicado, permite seleção manual paginada
ou quantidade aleatória conforme a regra da campanha, reserva pela API existente
e mostra o valor/prazo do servidor. Não envia Pix, cartão, webhook, nem usa
WebView. Os títulos somente aparecem se o pedido estiver pago e a rota
`/purchases/:id/tickets` devolver títulos vendidos.

A API é a autoridade sobre disponibilidade, preço, prazo, propriedade, emissão
de títulos e conflitos. Uma repetição após erro de conexão preserva a chave
da mesma tentativa enquanto a tela está aberta; ao reabrir, o fechamento
incerto deve ser conferido em Pedidos ou na reserva ativa antes de tentar outra
compra. A troca de conta remonta os componentes e ignora respostas da conta
anterior. A mesma reserva aparece no histórico web e mobile por ID quando os
dois clientes usam a mesma API lógica.

## Montagem no checkout preservado do Mac

`App.tsx` e manifestos do Expo não foram modificados nesta fatia. Depois de
preservar a WebView e as mudanças locais, importe os componentes na versão
de integração. No ramo de comprador em `CampaignDetail` (aba Campanhas), depois
da resposta de detalhe carregada, substitua somente a mensagem de funcionalidade
indisponível por:

```tsx
{state.data && (
  <NativeBuyerReservation
    client={client}
    campaign={state.data}
    onOrder={(order) =>
      navigation.navigate("Order", { item: order, totalNumbers: state.data?.totalNumbers })
    }
  />
)}
```

Use `NativeBuyerOrder` no detalhe do pedido do comprador para reaproveitar a
consulta condicionada ao status confirmado. Os componentes foram projetados para
ficar dentro da `Page` existente e mantêm a paleta/estilos nativos. O fluxo do
organizador permanece separado.

```tsx
<NativeBuyerOrder
  client={client}
  orderId={item.id}
  totalNumbers={route.params.totalNumbers}
/>
```

Quantidade, busca, autenticação, idempotência e visibilidade de títulos:
`cd apps/mobile && node --import tsx --test tests/*.test.ts`.

O smoke de integração disponível em `scripts/test-buyer-reservation-local.ts`
requer API real em loopback na porta 3338, duas contas sintéticas, duas campanhas
publicadas (uma manual e uma aleatória, ambas com preço unitário 1) e banco
isolado. Consulte as variáveis no início do script. O teste reserva e cancela
cotas sintéticas e não chama nenhuma rota de pagamento.

Ainda não inclui pagamento nativo, cupons/seleção de promoções no app, carteira
de títulos agregada, regra de expiração offline ou certificação no iPhone.
