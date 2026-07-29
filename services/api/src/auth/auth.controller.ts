import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminPermission, UserRole } from '@prisma/client';
import { AdminPermissions } from './decorators/admin-permissions.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  CompleteCheckoutBuyerDto,
  MiniBuyerDto,
  PhoneLookupDto,
} from './dto/checkout-buyer.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import { effectiveAdminPermissions } from './policies/admin-authorization.policy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  @Roles(UserRole.ADMIN)
  @AdminPermissions(AdminPermission.USERS_READ)
  async users() {
    return this.authService.users();
  }

  @Post('register')
  @Public()
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('checkout/phone-lookup')
  @Public()
  phoneLookup(@Body() data: PhoneLookupDto) {
    return this.authService.lookupBuyerByPhone(data.phone);
  }

  @Post('checkout/mini-register')
  @Public()
  miniRegister(@Body() data: MiniBuyerDto) {
    return this.authService.registerMiniBuyer(data);
  }

  @Post('checkout/start')
  @Public()
  startCheckout(@Body() data: PhoneLookupDto, @Req() request: Request) {
    return this.authService.startCheckout(data.phone, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('checkout/complete')
  completeCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CompleteCheckoutBuyerDto,
  ) {
    return this.authService.completeCheckoutBuyer(user.id, data);
  }

  @Post('login')
  @Public()
  async login(@Body() data: LoginDto, @Req() request: Request) {
    return this.authService.login(data, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('admin-login')
  @Public()
  async adminLogin(@Body() data: LoginDto, @Req() request: Request) {
    return this.authService.adminLogin(data, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() data: RefreshTokenDto) {
    return this.authService.refresh(data.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(data.email);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() data: ResetPasswordDto) {
    return this.authService.resetPassword(data.token, data.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    const { sessionId, ...profile } = user;
    void sessionId;
    return {
      ...profile,
      adminPermissions: effectiveAdminPermissions(
        profile.adminTeamRole,
        profile.adminPermissions,
      ),
    };
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.sessionId);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.id);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.sessions(user.id);
  }

  @Delete('sessions/:id')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.authService.revokeOwnedSession(user.id, id);
  }
}
