# Auditoria das APIs legadas

Data: 10 de julho de 2026

## API canônica

`services/api` é a API oficial do monorepo. Ela contém a implementação mais
recente de autenticação, validação global, Prisma, papéis de usuário e testes.

## Cópia legada `api`

Esta cópia continha módulos NestJS para usuários, campanhas, pagamentos,
títulos, carteira, afiliados, notificações, administração e IA. Todos esses
módulos eram scaffolds vazios: controllers sem rotas, services sem regras de
negócio e nenhum modelo Prisma correspondente. Eles não foram incorporados
porque adicionariam endpoints aparentes sem funcionalidade real.

A autenticação dessa cópia também não foi incorporada. A versão canônica:

- impede cadastro público de administradores;
- diferencia comprador e organizador;
- exige CPF ou CNPJ conforme o papel;
- não devolve hash de senha;
- detecta duplicidade de e-mail, CPF e CNPJ;
- possui DTO e testes mais completos.

## Cópia legada `apps/api`

Esta cópia continha apenas um módulo de dashboard que devolvia métricas fixas
e fictícias. Ele não foi incorporado. O dashboard deverá ser implementado
posteriormente com autenticação, consultas reais e escopo por organizador.

## Código preservado

Nenhum código legado foi destruído. As cópias completas e seus metadados Git
estão preservados no diretório local ignorado `backups/`.

## Decisão arquitetural

O monorepo oficial usa:

- `apps/web` para a aplicação Next.js;
- `services/api` para a API NestJS;
- `packages` para bibliotecas compartilhadas futuras;
- `docs` para decisões e documentação técnica.

Novos módulos de domínio só devem ser adicionados quando incluírem regras de
negócio, persistência, autorização e testes correspondentes.
