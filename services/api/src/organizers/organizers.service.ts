import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizerDocumentType,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { createReadStream, existsSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrganizerStorageService } from './organizer-storage.service';
import { UpdateOrganizerProfileDto } from './dto/update-organizer-profile.dto';
import { UpdateCommercialTermsDto } from './dto/update-commercial-terms.dto';
import type { UploadedOrganizerFile } from './types/uploaded-file.type';
import { UpdateOrganizerAccountDto } from './dto/update-organizer-account.dto';
import * as bcrypt from 'bcrypt';

const profileInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
      role: true,
      verified: true,
      isActive: true,
    },
  },
  documents: { orderBy: { createdAt: 'desc' as const } },
} as const satisfies Prisma.OrganizerProfileInclude;

type OrganizerProfilePayload = Prisma.OrganizerProfileGetPayload<{
  include: typeof profileInclude;
}>;

type CommercialProfile = {
  userId?: string;
  logoStorageKey?: string | null;
  logoUrl?: string | null;
  platformFee: Prisma.Decimal | number;
  monthlyFee: Prisma.Decimal | number;
  customPlatformFee: Prisma.Decimal | number | null;
};

@Injectable()
export class OrganizersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: OrganizerStorageService,
  ) {}

  async getMyProfile(user: AuthenticatedUser) {
    const profile = await this.ensureProfile(user);
    return this.serialize(profile);
  }

  async updateMyProfile(
    user: AuthenticatedUser,
    data: UpdateOrganizerProfileDto,
  ) {
    const current = await this.ensureProfile(user);
    this.ensureEditable(current.verificationStatus);
    const resetVerification = (
      [
        VerificationStatus.VERIFIED,
        VerificationStatus.UNDER_REVIEW,
        VerificationStatus.CORRECTION_REQUESTED,
        VerificationStatus.DOCUMENT_REQUESTED,
        VerificationStatus.REJECTED,
      ] as VerificationStatus[]
    ).includes(current.verificationStatus);

    const profile = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.organizerProfile.update({
        where: { userId: user.id },
        data: {
          ...data,
          birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
          state: data.state?.toUpperCase(),
          ...(resetVerification
            ? {
                verificationStatus: VerificationStatus.PENDING,
                rejectionReason: null,
                reviewedAt: null,
                reviewedById: null,
              }
            : {}),
        },
        include: profileInclude,
      });

      await transaction.user.update({
        where: { id: user.id },
        data: {
          name: data.fullName,
          cpf: data.cpf,
          phone: data.phone,
          cnpj: data.cnpj,
          city: data.city,
          state: data.state?.toUpperCase(),
          ...(resetVerification ? { verified: false } : {}),
        },
      });
      return updated;
    });

    return this.serialize(profile);
  }

  async updateMyAccount(
    user: AuthenticatedUser,
    data: UpdateOrganizerAccountDto,
  ) {
    if (data.newPassword) {
      if (!data.currentPassword)
        throw new BadRequestException('Informe a senha atual.');
      const current = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      if (
        !current ||
        !(await bcrypt.compare(data.currentPassword, current.password))
      )
        throw new BadRequestException('A senha atual está incorreta.');
    }
    const email = data.email?.trim().toLowerCase();
    const conflict = await this.prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [
          email ? { email } : undefined,
          data.cpf ? { cpf: data.cpf } : undefined,
          data.cnpj ? { cnpj: data.cnpj } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true },
    });
    if (conflict)
      throw new BadRequestException('E-mail, CPF ou CNPJ já cadastrado.');
    const organizerProfile = await this.prisma.organizerProfile.findUnique({
      where: { userId: user.id },
      select: { verificationStatus: true },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const account = await tx.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          email,
          phone: data.phone,
          cpf: data.cpf,
          cnpj: data.cnpj,
          city: data.city,
          state: data.state?.toUpperCase(),
          ...((
            [
              VerificationStatus.CORRECTION_REQUESTED,
              VerificationStatus.REJECTED,
            ] as VerificationStatus[]
          ).includes(organizerProfile?.verificationStatus as VerificationStatus)
            ? {
                verificationStatus: VerificationStatus.PENDING,
                reviewedAt: null,
                reviewedById: null,
              }
            : {}),
          ...(data.newPassword
            ? { password: await bcrypt.hash(data.newPassword, 12) }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
          cnpj: true,
          city: true,
          state: true,
          verified: true,
          role: true,
        },
      });
      await tx.organizerProfile.updateMany({
        where: { userId: user.id },
        data: {
          fullName: data.name,
          phone: data.phone,
          cpf: data.cpf,
          cnpj: data.cnpj,
          city: data.city,
          state: data.state?.toUpperCase(),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: user.id,
          action: data.newPassword
            ? 'ORGANIZER_ACCOUNT_AND_PASSWORD_UPDATED'
            : 'ORGANIZER_ACCOUNT_UPDATED',
          actorUserId: user.id,
          actorRole: user.role,
        },
      });
      return account;
    });
    return updated;
  }

  async uploadLogo(user: AuthenticatedUser, file?: UploadedOrganizerFile) {
    const current = await this.ensureProfile(user);
    this.ensureEditable(current.verificationStatus);
    if (file?.mimetype === 'application/pdf') {
      throw new BadRequestException('A logo deve ser uma imagem.');
    }
    const stored = await this.storage.save(current.id, file);
    const resetVerification = (
      [
        VerificationStatus.VERIFIED,
        VerificationStatus.CORRECTION_REQUESTED,
        VerificationStatus.REJECTED,
      ] as VerificationStatus[]
    ).includes(current.verificationStatus);
    const profile = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.organizerProfile.update({
        where: { id: current.id },
        data: {
          logoStorageKey: stored.storageKey,
          logoOriginalName: stored.originalName,
          logoMimeType: stored.mimeType,
          ...(resetVerification
            ? {
                verificationStatus: VerificationStatus.PENDING,
                reviewedAt: null,
                reviewedById: null,
              }
            : {}),
        },
        include: profileInclude,
      });
      if (resetVerification) {
        await transaction.user.update({
          where: { id: user.id },
          data: { verified: false },
        });
      }
      return updated;
    });
    return this.serialize(profile);
  }

  async uploadDocument(
    user: AuthenticatedUser,
    type: OrganizerDocumentType,
    file?: UploadedOrganizerFile,
  ) {
    const current = await this.ensureProfile(user);
    this.ensureEditable(current.verificationStatus);
    const stored = await this.storage.save(current.id, file);
    const resetVerification =
      current.verificationStatus === VerificationStatus.VERIFIED;
    await this.prisma.$transaction(async (transaction) => {
      const latest = await transaction.organizerDocument.aggregate({
        where: { organizerProfileId: current.id, type },
        _max: { version: true },
      });
      await transaction.organizerDocument.create({
        data: {
          organizerProfileId: current.id,
          type,
          version: (latest._max.version ?? 0) + 1,
          originalName: stored.originalName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          size: stored.size,
          status: 'SUBMITTED',
        },
      });
      if (
        resetVerification ||
        current.verificationStatus === VerificationStatus.DOCUMENT_REQUESTED ||
        current.verificationStatus === VerificationStatus.CORRECTION_REQUESTED
      ) {
        await transaction.organizerProfile.update({
          where: { id: current.id },
          data: {
            verificationStatus: VerificationStatus.PENDING,
            reviewedAt: null,
            reviewedById: null,
          },
        });
        await transaction.user.update({
          where: { id: user.id },
          data: { verified: false },
        });
      }
    });
    return this.getMyProfile(user);
  }

  async submit(user: AuthenticatedUser) {
    const profile = await this.ensureProfile(user);
    this.ensureEditable(profile.verificationStatus);
    if (!profile.planSelectedAt) {
      throw new BadRequestException('Escolha um plano para continuar.');
    }
    const missing = this.missingRequirements(profile);
    if (missing.length) {
      throw new BadRequestException(
        `Complete os seguintes campos: ${missing.join(', ')}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const submitted = await transaction.organizerProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: VerificationStatus.PENDING,
          rejectionReason: null,
          publicReviewMessage: null,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
        },
        include: profileInclude,
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'OrganizerProfile',
          entityId: profile.id,
          action: 'ORGANIZER_SUBMITTED_FOR_REVIEW',
          actorUserId: user.id,
          actorRole: user.role,
          newData: { verificationStatus: VerificationStatus.PENDING },
        },
      });
      const reviewers = await transaction.user.findMany({
        where: { role: UserRole.ADMIN, isActive: true },
        select: { id: true },
      });
      if (reviewers.length) {
        await transaction.notification.createMany({
          data: reviewers.map((reviewer) => ({
            userId: reviewer.id,
            type: 'ORGANIZER_REVIEW_PENDING',
            title: 'Novo cadastro aguardando análise',
            message: `${submitted.organizationName || submitted.fullName} enviou o cadastro para análise.`,
            data: { organizerUserId: user.id, organizerProfileId: profile.id },
          })),
        });
      }
      return submitted;
    });
    return this.serialize(updated);
  }

  async list(status?: VerificationStatus) {
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.ORGANIZER,
        ...(status ? { organizerProfile: { verificationStatus: status } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
        verified: true,
        isActive: true,
        createdAt: true,
        organizerProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => ({
      ...user,
      organizerProfile: user.organizerProfile
        ? this.serializeCommercial(user.organizerProfile)
        : null,
    }));
  }

  async getById(userId: string) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (!profile) throw new NotFoundException('Organizador não encontrado.');
    return this.serialize(profile);
  }

  async review(
    userId: string,
    adminId: string,
    status: VerificationStatus,
    reason?: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('Informe a justificativa da decisão.');
    const current = await this.prisma.organizerProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    });
    if (!current) throw new NotFoundException('Organizador não encontrado.');
    if (current.verificationStatus !== VerificationStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        'Somente cadastros em análise podem ser aprovados ou rejeitados.',
      );
    }

    const verified = status === VerificationStatus.VERIFIED;
    const updated = await this.prisma.$transaction(async (transaction) => {
      const profile = await transaction.organizerProfile.update({
        where: { userId },
        data: {
          verificationStatus: status,
          rejectionReason: verified ? null : reason?.trim(),
          reviewedAt: new Date(),
          reviewedById: adminId,
        },
        include: profileInclude,
      });
      await transaction.user.update({
        where: { id: userId },
        data: { verified },
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'OrganizerProfile',
          entityId: profile.id,
          action: 'ORGANIZER_REVIEWED',
          actorUserId: adminId,
          actorRole: UserRole.ADMIN,
          previousData: { verificationStatus: current.verificationStatus },
          newData: { verificationStatus: status },
          metadata: { reason: reason.trim() },
        },
      });
      await transaction.notification.create({
        data: {
          userId,
          type: 'ORGANIZER_REVIEW',
          title: verified ? 'Cadastro aprovado' : 'Cadastro precisa de atenção',
          message: verified
            ? 'Seu perfil foi verificado pela SorteX.'
            : reason.trim(),
          data: { status },
        },
      });
      return profile;
    });
    return this.serialize(updated);
  }

  async updateCommercialTerms(
    userId: string,
    data: UpdateCommercialTermsDto,
    admin: AuthenticatedUser,
  ) {
    const current = await this.getById(userId);
    const profile = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.organizerProfile.update({
        where: { userId },
        data,
        include: profileInclude,
      });
      await transaction.auditLog.create({
        data: {
          entityType: 'OrganizerProfile',
          entityId: updated.id,
          action: 'COMMERCIAL_TERMS_UPDATED',
          actorUserId: admin.id,
          actorRole: admin.role,
          previousData: current,
          newData: data as unknown as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    return this.serialize(profile);
  }

  async getDocumentFile(documentId: string, user: AuthenticatedUser) {
    const document = await this.prisma.organizerDocument.findUnique({
      where: { id: documentId },
      include: { organizerProfile: { select: { userId: true } } },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    if (
      user.role !== UserRole.ADMIN &&
      document.organizerProfile.userId !== user.id
    ) {
      throw new ForbiddenException('Você não pode acessar este documento.');
    }
    if (user.role === UserRole.ADMIN && !user.adminTeamRole)
      throw new ForbiddenException('Acesso administrativo inválido.');
    if (user.role === UserRole.ADMIN)
      await this.prisma.auditLog.create({
        data: {
          entityType: 'OrganizerDocument',
          entityId: document.id,
          action: 'ORGANIZER_DOCUMENT_VIEWED',
          actorUserId: user.id,
          actorRole: user.role,
          metadata: { organizerUserId: document.organizerProfile.userId },
        },
      });
    return this.fileResponse(
      document.storageKey,
      document.mimeType,
      document.originalName,
    );
  }

  async getLogoFile(userId: string) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId },
      select: {
        logoStorageKey: true,
        logoMimeType: true,
        logoOriginalName: true,
      },
    });
    if (!profile?.logoStorageKey) {
      throw new NotFoundException('Logo não encontrada.');
    }
    return this.fileResponse(
      profile.logoStorageKey,
      profile.logoMimeType ?? 'application/octet-stream',
      profile.logoOriginalName ?? 'logo',
    );
  }

  private async ensureProfile(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER) {
      throw new ForbiddenException('Apenas organizadores possuem este perfil.');
    }
    return this.prisma.organizerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: user.name,
        cpf: user.cpf ?? '',
        phone: user.phone ?? '',
        cnpj: user.cnpj,
        city: user.city,
        state: user.state,
        verificationStatus: VerificationStatus.INCOMPLETE,
      },
      include: profileInclude,
    });
  }

  private ensureEditable(status: VerificationStatus) {
    if (
      (
        [
          VerificationStatus.SUSPENDED,
          VerificationStatus.BLOCKED,
          VerificationStatus.CLOSED,
        ] as VerificationStatus[]
      ).includes(status)
    ) {
      throw new BadRequestException(
        'Este cadastro não pode ser alterado no momento.',
      );
    }
  }

  private missingRequirements(profile: OrganizerProfilePayload) {
    const documents = new Set(profile.documents.map((item) => item.type));
    return [
      ['nome completo', profile.fullName],
      ['CPF', profile.cpf],
      ['celular', profile.phone],
      ['data de nascimento', profile.birthDate],
      ['nome da organização', profile.organizationName],
      ['CEP', profile.postalCode],
      ['endereço', profile.address],
      ['número', profile.addressNumber],
      ['cidade', profile.city],
      ['estado', profile.state],
      ['logo', profile.logoStorageKey],
      [
        'documento de identificação',
        documents.has(OrganizerDocumentType.IDENTITY),
      ],
      [
        'comprovante de endereço',
        documents.has(OrganizerDocumentType.ADDRESS_PROOF),
      ],
      [
        'documento do CNPJ',
        !profile.cnpj || documents.has(OrganizerDocumentType.CNPJ_DOCUMENT),
      ],
    ]
      .filter(([, value]) => !value)
      .map(([label]) => String(label));
  }

  private fileResponse(storageKey: string, mimeType: string, name: string) {
    const path = this.storage.resolve(storageKey);
    if (!existsSync(path))
      throw new NotFoundException('Arquivo não encontrado.');
    return { stream: createReadStream(path), mimeType, name };
  }

  private serialize(profile: OrganizerProfilePayload) {
    const { logoStorageKey, ...safeProfile } = profile;
    void logoStorageKey;
    return {
      ...this.serializeCommercial(safeProfile),
      birthDate: profile.birthDate?.toISOString() ?? null,
      logoUrl: profile.logoStorageKey
        ? `/organizers/${profile.userId}/logo`
        : null,
      documents: (profile.documents ?? []).map(
        ({ storageKey, ...document }) => {
          void storageKey;
          return {
            ...document,
            fileUrl: `/organizers/documents/${document.id}/file`,
          };
        },
      ),
    };
  }

  private serializeCommercial<T extends CommercialProfile>(profile: T) {
    const { logoStorageKey, ...safeProfile } = profile;
    return {
      ...safeProfile,
      logoUrl: logoStorageKey
        ? `/organizers/${profile.userId}/logo`
        : (profile.logoUrl ?? null),
      platformFee: Number(profile.platformFee),
      monthlyFee: Number(profile.monthlyFee),
      customPlatformFee:
        profile.customPlatformFee == null
          ? null
          : Number(profile.customPlatformFee),
    };
  }
}
