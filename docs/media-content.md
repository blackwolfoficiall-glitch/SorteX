# Conteúdo automático e central de mídia — Módulo 10B

## Templates e formatos

Templates são blocos JSON versionados, com dimensões entre 320 e 4096 pixels. A SorteX inclui modelos iniciais para campanha, ganhador, cota premiada e afiliado nos formatos 1:1, 4:5 e 9:16. Templates do sistema não podem ser alterados pelo organizador.

## Identidade visual

O perfil de marca reutiliza a logo do organizador e permite cores, nome público, Instagram, WhatsApp mascarado e slogan. Materiais verificados preservam a identificação SorteX.

## Renderização

Prévias e imagens estáticas são arquivos SVG reais, gravados pela abstração local de armazenamento com limite de 2 MB. O resultado é determinístico, possui dimensões corretas e pode ser aberto ou baixado. PNG/JPEG exigirão um rasterizador leve futuro; não são simulados.

Vídeos usam `VIDEO_FRAME`, configuração do editor e `MediaRenderJob`. O job permanece enfileirado até existir um worker dedicado, sem bloquear a requisição e sem marcar um arquivo inexistente como pronto.

## Ganhadores e privacidade

Conteúdo de ganhador só é retornado quando `publicDisclosureAuthorized` está ativo. CPF, telefone, e-mail, dados bancários e comprovantes nunca entram no material. O código público gera uma URL `/verificar/:codigo` armazenada como `qrCodeValue`.

O QR gráfico ainda depende da adoção de um codificador interno confiável. Nesta etapa, a URL opaca é preservada e exibida como código verificável; nenhum QR falso é gerado.

## Compartilhamento

Links `/s/:code` registram cliques e contagem única aproximada usando somente hash de visitante. A interface abre WhatsApp e Telegram, usa Web Share API quando disponível e permite copiar o link. Não publica automaticamente.

## Segurança e limitações

Textos são sanitizados e escapados no SVG. Assets usam MIME permitido, limite de tamanho e proteção contra path traversal. Não há IA, Meta API, TikTok API, WhatsApp API, renderização pesada de vídeo, música comercial ou moderação externa. Todos os novos modelos dependem de migração futura não aplicada.
