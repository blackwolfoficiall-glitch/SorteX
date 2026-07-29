import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizerIntegrationStatus,
  OrganizerIntegrationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfigureIntegrationDto } from './dto/integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    this.organizer(user);
    const items = await this.prisma.organizerIntegration.findMany({
      where: { organizerId: user.id },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { type: 'asc' },
    });
    return items.map((item) => this.safe(item));
  }

  async configure(user: AuthenticatedUser, dto: ConfigureIntegrationDto) {
    this.organizer(user);
    if (!dto.sandbox) {
      throw new BadRequestException(
        'Somente o ambiente sandbox está disponível nesta etapa.',
      );
    }
    const secretHash = dto.credential
      ? createHash('sha256').update(dto.credential).digest('hex')
      : undefined;
    const item = await this.prisma.organizerIntegration.upsert({
      where: { organizerId_type: { organizerId: user.id, type: dto.type } },
      create: {
        organizerId: user.id,
        type: dto.type,
        status: OrganizerIntegrationStatus.CONFIGURING,
        displayName: dto.displayName,
        accountId: dto.accountId,
        provider: dto.provider,
        publicConfig: (dto.publicConfig ?? {}) as Prisma.InputJsonValue,
        secretHash,
        webhookUrl: dto.webhookUrl,
        sandbox: true,
        permissions: dto.permissions ?? [],
      },
      update: {
        status: OrganizerIntegrationStatus.CONFIGURING,
        displayName: dto.displayName,
        accountId: dto.accountId,
        provider: dto.provider,
        publicConfig: (dto.publicConfig ?? {}) as Prisma.InputJsonValue,
        ...(secretHash ? { secretHash } : {}),
        webhookUrl: dto.webhookUrl,
        sandbox: true,
        permissions: dto.permissions ?? [],
        lastError: null,
      },
    });
    await this.log(
      item.id,
      'CONFIGURED',
      'SUCCESS',
      'Configuração sandbox salva.',
    );
    await this.audit(user, item.id, 'INTEGRATION_CONFIGURED');
    return this.safe(item);
  }

  async registerInterest(user: AuthenticatedUser, integration?: string) {
    this.organizer(user);
    const allowed = [
      'GOOGLE_ADS',
      'TIKTOK_ADS',
      'TELEGRAM',
      'X_ADS',
      'ZAPIER',
      'MAKE',
    ];
    if (!integration || !allowed.includes(integration))
      throw new BadRequestException('Selecione uma integração válida.');
    const existing = await this.prisma.auditLog.findFirst({
      where: {
        actorUserId: user.id,
        entityType: 'IntegrationInterest',
        entityId: integration,
        action: 'INTEGRATION_INTEREST_REGISTERED',
      },
    });
    if (!existing)
      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          entityType: 'IntegrationInterest',
          entityId: integration,
          action: 'INTEGRATION_INTEREST_REGISTERED',
          metadata: { integration },
        },
      });
    return { registered: true, integration };
  }

  async action(
    user: AuthenticatedUser,
    id: string,
    action: 'connect' | 'test' | 'sync' | 'disconnect',
  ) {
    const current = await this.owned(user, id);
    if (action === 'connect') {
      const updated = await this.prisma.organizerIntegration.update({
        where: { id },
        data: {
          status: OrganizerIntegrationStatus.SANDBOX_CONNECTED,
          lastTestedAt: new Date(),
          lastError: null,
        },
      });
      await this.log(
        id,
        'CONNECTED',
        'SUCCESS',
        'Conexão local validada em sandbox.',
      );
      await this.audit(user, id, 'INTEGRATION_SANDBOX_CONNECTED');
      return {
        ...this.safe(updated),
        message: 'Conectado em sandbox. Nenhum serviço externo foi acionado.',
      };
    }
    if (action === 'test') {
      const valid = Boolean(
        current.accountId || current.displayName || current.provider,
      );
      const updated = await this.prisma.organizerIntegration.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          status: valid
            ? OrganizerIntegrationStatus.SANDBOX_CONNECTED
            : OrganizerIntegrationStatus.ERROR,
          lastError: valid
            ? null
            : 'Preencha ao menos a identificação da conta.',
        },
      });
      await this.log(
        id,
        'TESTED',
        valid ? 'SUCCESS' : 'ERROR',
        valid ? 'Teste local concluído.' : 'Configuração incompleta.',
      );
      return { ...this.safe(updated), testPassed: valid, sandbox: true };
    }
    if (action === 'sync') {
      if (current.status !== OrganizerIntegrationStatus.SANDBOX_CONNECTED) {
        throw new BadRequestException(
          'Conecte e teste a integração antes de sincronizar.',
        );
      }
      const updated = await this.prisma.organizerIntegration.update({
        where: { id },
        data: { lastSyncedAt: new Date() },
      });
      await this.log(
        id,
        'SYNCED',
        'SUCCESS',
        'Sincronização simulada localmente.',
      );
      return {
        ...this.safe(updated),
        message: 'Sincronização processada em sandbox.',
      };
    }
    const updated = await this.prisma.organizerIntegration.update({
      where: { id },
      data: {
        status: OrganizerIntegrationStatus.DISCONNECTED,
        secretHash: null,
        secretCiphertext: null,
      },
    });
    await this.log(id, 'DISCONNECTED', 'SUCCESS', 'Integração desconectada.');
    await this.audit(user, id, 'INTEGRATION_DISCONNECTED');
    return this.safe(updated);
  }

  async logs(user: AuthenticatedUser, id: string) {
    await this.owned(user, id);
    return this.prisma.organizerIntegrationLog.findMany({
      where: { integrationId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async metaOAuthUrl(user: AuthenticatedUser, kind: string) {
    this.organizer(user);
    const type =
      kind === 'WHATSAPP'
        ? OrganizerIntegrationType.WHATSAPP
        : OrganizerIntegrationType.META_ADS;
    const appId = process.env.META_APP_ID,
      redirect = process.env.META_REDIRECT_URI;
    if (!appId || !redirect || !process.env.META_APP_SECRET)
      throw new BadRequestException(
        'A conexão com a Meta está temporariamente indisponível. Tente novamente mais tarde.',
      );
    if (
      type === OrganizerIntegrationType.WHATSAPP &&
      !process.env.META_WHATSAPP_CONFIG_ID
    )
      throw new BadRequestException(
        'A conexão oficial com o WhatsApp Business está temporariamente indisponível.',
      );
    const state = this.signState({
      organizerId: user.id,
      type,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const scopes =
      type === OrganizerIntegrationType.WHATSAPP
        ? [
            'business_management',
            'whatsapp_business_management',
            'whatsapp_business_messaging',
          ]
        : [
            'ads_management',
            'ads_read',
            'business_management',
            'pages_show_list',
            'instagram_basic',
          ];
    const url = new URL('https://www.facebook.com/dialog/oauth');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scopes.join(','));
    url.searchParams.set('response_type', 'code');
    if (type === OrganizerIntegrationType.WHATSAPP)
      url.searchParams.set('config_id', process.env.META_WHATSAPP_CONFIG_ID!);
    return { url: url.toString(), type, official: true };
  }

  async metaOAuthCallback(code: string, state: string) {
    if (!code || !state)
      throw new BadRequestException(
        'Não foi possível concluir a conexão. Tente novamente.',
      );
    const parsed = this.verifyState(state),
      redirect = process.env.META_REDIRECT_URI!,
      version = process.env.META_GRAPH_VERSION || 'v23.0';
    const tokenUrl = new URL(
      `https://graph.facebook.com/${version}/oauth/access_token`,
    );
    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', redirect);
    tokenUrl.searchParams.set('code', code);
    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok)
      throw new BadRequestException(
        'A Meta recusou a autorização. Tente conectar novamente.',
      );
    const token = (await tokenResponse.json()) as { access_token: string };
    const publicConfig = await this.discoverMeta(
      token.access_token,
      parsed.type,
      version,
    );
    const item = await this.prisma.organizerIntegration.upsert({
      where: {
        organizerId_type: {
          organizerId: parsed.organizerId,
          type: parsed.type,
        },
      },
      create: {
        organizerId: parsed.organizerId,
        type: parsed.type,
        status: OrganizerIntegrationStatus.CONNECTED,
        provider: 'Meta',
        displayName:
          parsed.type === OrganizerIntegrationType.WHATSAPP
            ? 'WhatsApp Business'
            : 'Meta Ads',
        publicConfig,
        secretHash: createHash('sha256')
          .update(token.access_token)
          .digest('hex'),
        secretCiphertext: this.encrypt(token.access_token),
        sandbox: false,
        permissions:
          parsed.type === OrganizerIntegrationType.WHATSAPP
            ? ['whatsapp_business_management', 'whatsapp_business_messaging']
            : [
                'ads_management',
                'ads_read',
                'business_management',
                'pages_show_list',
                'instagram_basic',
              ],
        lastTestedAt: new Date(),
        lastSyncedAt: new Date(),
      },
      update: {
        status: OrganizerIntegrationStatus.CONNECTED,
        provider: 'Meta',
        publicConfig,
        secretHash: createHash('sha256')
          .update(token.access_token)
          .digest('hex'),
        secretCiphertext: this.encrypt(token.access_token),
        sandbox: false,
        lastError: null,
        lastTestedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
    await this.log(
      item.id,
      'OAUTH_CONNECTED',
      'SUCCESS',
      'Conta conectada pela autorização oficial da Meta.',
    );
    return `${process.env.WEB_APP_URL || 'http://localhost:3000'}/dashboard/integracoes?connected=${parsed.type}`;
  }

  verifyWebhook(mode: string, token: string, challenge: string) {
    if (
      mode !== 'subscribe' ||
      !process.env.META_WEBHOOK_VERIFY_TOKEN ||
      token !== process.env.META_WEBHOOK_VERIFY_TOKEN
    )
      throw new BadRequestException('Não foi possível verificar o webhook.');
    return challenge;
  }
  async handleWebhook(
    body: Record<string, unknown>,
    signature: string,
    rawBody?: Buffer,
  ) {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !signature || !rawBody)
      throw new BadRequestException('Assinatura do webhook ausente.');
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    if (
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    )
      throw new BadRequestException('Assinatura do webhook inválida.');
    const entries = Array.isArray((body as any).entry)
      ? (body as any).entry
      : [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const phoneId = change.value?.metadata?.phone_number_id;
        if (!phoneId) continue;
        const integrations = await this.prisma.organizerIntegration.findMany({
          where: {
            type: OrganizerIntegrationType.WHATSAPP,
            status: OrganizerIntegrationStatus.CONNECTED,
          },
        });
        const integration = integrations.find(
          (i) => (i.publicConfig as any)?.phoneNumberId === phoneId,
        );
        if (integration)
          await this.log(
            integration.id,
            'WEBHOOK_RECEIVED',
            'SUCCESS',
            'Atualização oficial recebida do WhatsApp Business.',
          );
      }
    }
    return { received: true };
  }

  async sendWhatsAppTemplate(
    user: AuthenticatedUser,
    id: string,
    to: string,
    template: string,
    language = 'pt_BR',
  ) {
    const integration = await this.owned(user, id);
    if (integration.type !== OrganizerIntegrationType.WHATSAPP)
      throw new BadRequestException('Selecione uma integração WhatsApp.');
    if (
      integration.sandbox ||
      integration.status !== OrganizerIntegrationStatus.CONNECTED
    ) {
      await this.log(
        id,
        'MESSAGE_SANDBOX',
        'SUCCESS',
        `Template ${template} registrado em sandbox.`,
      );
      return {
        sandbox: true,
        sent: false,
        message: 'Simulação registrada. Nenhuma mensagem externa foi enviada.',
      };
    }
    const token = this.decrypt(integration.secretCiphertext),
      phoneId = (integration.publicConfig as any)?.phoneNumberId;
    if (!token || !phoneId)
      throw new BadRequestException(
        'A conta WhatsApp não possui token ou número configurado.',
      );
    const version = process.env.META_GRAPH_VERSION || 'v23.0',
      response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: { name: template, language: { code: language } },
          }),
        },
      );
    if (!response.ok) {
      await this.log(
        id,
        'MESSAGE_FAILED',
        'ERROR',
        'A API oficial recusou o envio.',
      );
      throw new BadRequestException(
        'O WhatsApp Business recusou o envio do modelo aprovado.',
      );
    }
    await this.log(
      id,
      'MESSAGE_SENT',
      'SUCCESS',
      `Template ${template} enviado pela API oficial.`,
    );
    return { sent: true, sandbox: false };
  }

  private async discoverMeta(
    token: string,
    type: OrganizerIntegrationType,
    version: string,
  ) {
    const fields = 'id,name';
    const businessFields =
      type === OrganizerIntegrationType.WHATSAPP
        ? 'id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}'
        : 'id,name';
    const [me, businesses, accounts, pages] = await Promise.all([
      this.graph(`/${version}/me?fields=${fields}`, token),
      this.graph(`/${version}/me/businesses?fields=${businessFields}`, token),
      type === OrganizerIntegrationType.META_ADS
        ? this.graph(
            `/${version}/me/adaccounts?fields=id,name,account_status,currency`,
            token,
          )
        : Promise.resolve({ data: [] }),
      this.graph(
        `/${version}/me/accounts?fields=id,name,instagram_business_account`,
        token,
      ),
    ]);
    const whatsappAccount = businesses.data?.flatMap(
      (business: any) => business.owned_whatsapp_business_accounts?.data ?? [],
    )[0];
    const whatsappNumber = whatsappAccount?.phone_numbers?.data?.[0];
    return {
      user: me,
      businesses: businesses.data ?? [],
      adAccounts: accounts.data ?? [],
      pages: pages.data ?? [],
      phoneNumberId: whatsappNumber?.id ?? null,
      displayPhoneNumber: whatsappNumber?.display_phone_number ?? null,
      whatsappBusinessAccountId: whatsappAccount?.id ?? null,
    };
  }
  private async graph(path: string, token: string) {
    const r = await fetch(`https://graph.facebook.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { data: [] };
    return r.json();
  }
  private signState(value: Record<string, unknown>) {
    const data = Buffer.from(JSON.stringify(value)).toString('base64url'),
      signature = createHmac('sha256', process.env.META_APP_SECRET!)
        .update(data)
        .digest('base64url');
    return `${data}.${signature}`;
  }
  private verifyState(state: string) {
    const [data, signature] = state.split('.'),
      expected = createHmac('sha256', process.env.META_APP_SECRET!)
        .update(data)
        .digest('base64url');
    if (
      !signature ||
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    )
      throw new BadRequestException(
        'Esta tentativa de conexão não é mais válida. Inicie novamente.',
      );
    const value = JSON.parse(Buffer.from(data, 'base64url').toString()) as {
      organizerId: string;
      type: OrganizerIntegrationType;
      expiresAt: number;
    };
    if (value.expiresAt < Date.now())
      throw new BadRequestException('A autorização expirou.');
    return value;
  }
  private encryptionKey() {
    const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!secret)
      throw new BadRequestException(
        'A conexão está temporariamente indisponível. Tente novamente mais tarde.',
      );
    return createHash('sha256').update(secret).digest();
  }
  private encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv),
      encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]),
      tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }
  private decrypt(value?: string | null) {
    if (!value) return null;
    const all = Buffer.from(value, 'base64url'),
      iv = all.subarray(0, 12),
      tag = all.subarray(12, 28),
      encrypted = all.subarray(28),
      decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  private async owned(user: AuthenticatedUser, id: string) {
    this.organizer(user);
    const item = await this.prisma.organizerIntegration.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!item) throw new NotFoundException('Integração não encontrada.');
    return item;
  }
  private organizer(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER)
      throw new NotFoundException('Integração não encontrada.');
  }
  private safe<
    T extends { secretHash?: string | null; secretCiphertext?: string | null },
  >(item: T) {
    const { secretHash, secretCiphertext, ...safe } = item;
    void secretCiphertext;
    return {
      ...safe,
      credentialConfigured: Boolean(secretHash),
    };
  }
  private log(
    integrationId: string,
    action: string,
    status: string,
    message: string,
  ) {
    return this.prisma.organizerIntegrationLog.create({
      data: {
        integrationId,
        action,
        status,
        message,
        metadata: { sandbox: true },
      },
    });
  }
  private audit(user: AuthenticatedUser, entityId: string, action: string) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'OrganizerIntegration',
        entityId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        metadata: { sandbox: true },
      },
    });
  }
}
