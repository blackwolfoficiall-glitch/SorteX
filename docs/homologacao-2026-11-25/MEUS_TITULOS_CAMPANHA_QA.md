# Meus Títulos na página pública da campanha

Em banco descartável com Next em build de produção, HTTPS de loopback e API
Nest real, o atalho anônimo da campanha piloto antes abria o login com
`returnTo`, que o login de senha não consome. O caminho verificado passa
`next` com o destino de mesma origem e a indicação para reabrir o painel
`Meus Títulos` na campanha. Um destino externo é ignorado. Quando a sessão
é revogada enquanto o painel está aberto, os dados privados anteriores são
retirados antes de pedir novo login.

O painel confirma os títulos 42 e 314 somente no pedido sintético pago.
Uma reserva nova e depois cancelada aparece como **Valor do pedido**,
não **Valor pago**, sem números emitidos. Pedidos do mesmo comprador em
outra campanha não aparecem no painel atual. Uma terceira conta sem compra
não vê o pedido pago da primeira; a consulta individual retorna 404.
Apenas o pagamento sintético já registrado pelo seed local permanece no
banco; não há chamada a provedor, cobrança ou teste no iPhone físico.

Para reexecutar o cenário local, use as migrações e o seed sintético de
[Jornada web de campanhas](JORNADA_WEB_CAMPANHAS.md), incluindo
`SEED_PUBLIC_BROWSER_REWARDS=true` para a segunda campanha. No diretório
`apps/web`, execute `npm run test:e2e -- --config
playwright.buyer-history.config.ts --project desktop-chromium-history`
e, em outro processo Nest com banco descartável recém-preparado,
`npm run test:e2e -- --config playwright.buyer-history.config.ts --project
iphone-webkit-history`. Isolar cada navegador evita consumir o limite de
login somando os cenários; não altere o rate limiting.
