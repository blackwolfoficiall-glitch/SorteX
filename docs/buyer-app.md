# Área do comprador (Módulo 9A)

## Arquitetura

As telas em `apps/web/app/comprador` consomem exclusivamente rotas autenticadas da API NestJS por meio do proxy `/api/buyer/[...path]`. Reservas, preços e pagamentos continuam calculados no backend pelos módulos 4 e 5.

## Navegação

- `/comprador`: home com banners, destaques e campanhas reais.
- `/comprador/sorteios`: busca, categorias e ordenação.
- `/comprador/meus-numeros`: compras e títulos por status.
- `/comprador/compras/:id`: detalhe sanitizado da compra.
- `/comprador/checkout/:id`: PIX/cartão e contador da reserva.
- `/comprador/favoritos`, `/notificacoes`, `/suporte` e `/perfil`.

## API

`/buyer/home`, `/buyer/campaigns`, `/buyer/profile`, `/buyer/favorites`, `/buyer/notifications` e `/buyer/support` exigem JWT e perfil BUYER. Favoritos possuem unicidade por comprador/campanha. Notificações, chamados e perfil sempre são filtrados pelo usuário autenticado.

## Estados e limitações

Estados vazios e erros são exibidos sem campanhas fictícias. Push, WhatsApp, e-mail, app nativo, biometria, fidelidade e CRM permanecem fora do escopo. A alteração do Prisma para favoritos requer migração futura, que não foi executada nesta etapa.
