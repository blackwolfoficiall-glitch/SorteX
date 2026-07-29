import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ConfigureIntegrationDto } from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('organizer/integrations')
@Roles(UserRole.ORGANIZER)
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }
  @Put() configure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureIntegrationDto,
  ) {
    return this.service.configure(user, dto);
  }
  @Post('interests') interest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { integration?: string },
  ) {
    return this.service.registerInterest(user, body.integration);
  }
  @Post(':id/connect') connect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.action(user, id, 'connect');
  }
  @Post(':id/test') test(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.action(user, id, 'test');
  }
  @Post(':id/sync') sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.action(user, id, 'sync');
  }
  @Post(':id/disconnect') disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.action(user, id, 'disconnect');
  }
  @Get(':id/logs') logs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.logs(user, id);
  }
  @Post(':id/whatsapp/templates') sendTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { to: string; template: string; language?: string },
  ) {
    return this.service.sendWhatsAppTemplate(
      user,
      id,
      body.to,
      body.template,
      body.language,
    );
  }
  @Get('oauth/meta/start') metaOAuth(
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind: string,
  ) {
    return this.service.metaOAuthUrl(user, kind);
  }
}

@Controller('integrations/meta')
export class MetaIntegrationCallbackController {
  constructor(private readonly service: IntegrationsService) {}
  @Public() @Get('callback') @Redirect() async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const web = process.env.WEB_APP_URL || 'http://localhost:3000';
    if (error) return { url: `${web}/dashboard/integracoes?oauth=cancelled` };
    try {
      return {
        url: await this.service.metaOAuthCallback(code ?? '', state ?? ''),
      };
    } catch {
      return { url: `${web}/dashboard/integracoes?oauth=error` };
    }
  }
  @Public() @Get('webhook') verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.service.verifyWebhook(mode, token, challenge);
  }
  @Public() @Post('webhook') webhook(
    @Req() req: any,
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.handleWebhook(body, signature, req.rawBody);
  }
}
