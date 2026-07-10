import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
        role: true,
        city: true,
        state: true,
        isActive: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async register(data: RegisterDto) {
    const role = data.role ?? UserRole.BUYER;

    if (role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Administradores não podem ser criados pelo cadastro público.',
      );
    }

    if (role === UserRole.BUYER && !data.cpf) {
      throw new BadRequestException('CPF é obrigatório para compradores.');
    }

    if (role === UserRole.ORGANIZER && !data.cnpj) {
      throw new BadRequestException('CNPJ é obrigatório para organizadores.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.cpf ? [{ cpf: data.cpf }] : []),
          ...(data.cnpj ? [{ cnpj: data.cnpj }] : []),
        ],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('E-mail, CPF ou CNPJ já cadastrado.');
    }

    const password = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password,
        phone: data.phone,
        cpf: data.cpf,
        cnpj: data.cnpj,
        role,
        city: data.city,
        state: data.state,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
        role: true,
        city: true,
        state: true,
        isActive: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
