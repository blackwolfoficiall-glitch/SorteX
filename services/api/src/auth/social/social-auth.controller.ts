import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { SocialAuthService, socialProvider } from './social-auth.service';

@Controller('auth/social')
export class SocialAuthController {
  constructor(private readonly social: SocialAuthService) {}
  @Public() @Get('providers') providers() {
    return this.social.availability();
  }
  @Public() @Post('pending') pending(
    @Body() body: { registrationToken: string; browserProof: string },
  ) {
    return this.social.details(body.registrationToken, body.browserProof);
  }
  @Public() @Post('complete') complete(
    @Body()
    body: {
      registrationToken: string;
      browserProof: string;
      fields: Record<string, unknown>;
    },
  ) {
    return this.social.complete(
      body.registrationToken,
      body.browserProof,
      body.fields,
    );
  }
  @Post('link') link(
    @Body() body: { registrationToken: string; browserProof: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.social.link(body.registrationToken, body.browserProof, user);
  }
  @Public() @Post(':provider/start') start(
    @Param('provider') provider: string,
    @Body() body: { browserProof: string },
  ) {
    return this.social.start(socialProvider(provider), body.browserProof);
  }
  @Public() @Post(':provider/callback') callback(
    @Param('provider') provider: string,
    @Body() body: { state: string; code: string; browserProof: string },
  ) {
    return this.social.callback(socialProvider(provider), body);
  }
}
