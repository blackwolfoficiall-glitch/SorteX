# Portões externos de lançamento

Homologação técnica não dá autorização para lançar campanhas, cobrar títulos ou
submeter o app. Usar apenas dados sintéticos e ambiente/testes isolados.

- **Campanhas no Brasil:** a FAQ da SPA distingue promoções comerciais
  autorizadas, sem cobrança para concorrer, de rifas comuns e de exceções
  filantrópicas com requisitos próprios. O uso dos resultados da Loteria
  Federal não é autorização. Antes de liberar uma modalidade ou operações
  reais, obter parecer sobre o papel da plataforma, a mecânica, entidade
  promotora, destinação de recursos, remuneração e publicidade. Não presumir
  que receber via conta de terceiro, cobrar percentual ou cobrar assinatura
  resolve por si só o enquadramento. [FAQ SPA][spa], [Lei 5.768][lei],
  [Decreto-Lei 3.688][dl].
- **Publicação:** a aprovação do cadastro não equivale à aprovação da campanha.
  Manter rascunhos privados enquanto aplicável e conferir autorização,
  titular, período, modalidade, regulamento e requisitos de publicidade.
  A [consulta pública SCPC][scpc] pode apoiar a conferência onde for aplicável.
- **Pagamentos:** credenciais verificadas na área de testes do produto, evento
  assinado entregue pelo provedor, conciliação e identificação de provedores
  habilitados são portões técnicos. Antes de sair do sandbox, exigir aprovação
  documentada do adquirente para o modelo, Pix/cartão, responsabilidade e
  titularidade dos recebimentos e eventual split/repasse. A aprovação de um
  pagamento de teste não demonstra elegibilidade comercial. Não deduzir o
  ambiente pelo prefixo do token. [Termos de desenvolvedor Mercado Pago][mp],
  [credenciais de teste][test].
- **App Store:** verificar diretriz 5.3 e documentos exigidos para a modalidade,
  regras no app, atribuição, quem efetivamente patrocina, georrestrição e
  privacidade. Revisar exclusão de conta e contas para avaliação. Teste local
  do Xcode não é publicação. [Diretrizes Apple][apple],
  [documentos de revisão][appdoc].

[spa]: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/promocao-comercial/promocao-comercial/
[lei]: https://www.planalto.gov.br/ccivil_03/leis/l5768.htm
[dl]: https://www.planalto.gov.br/ccivil_03/decreto-lei/del3688.htm
[scpc]: https://scpc.seae.fazenda.gov.br/scpc/promocao_consulta_publica.jsf
[mp]: https://www.mercadopago.com.br/developers/pt/docs/resources/legal/terms-and-conditions
[test]: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/additional-content/your-integrations/credentials?scope=prod
[apple]: https://developer.apple.com/app-store/review/guidelines/#gaming-gambling-and-lotteries
[appdoc]: https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/
