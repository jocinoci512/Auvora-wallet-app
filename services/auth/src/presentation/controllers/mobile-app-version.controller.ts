import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { Public } from '../decorators/auth.decorators';

/**
 * Public mobile client version policy.
 * Numbers only — never accepts or serves APK/IPA binaries.
 */
@ApiTags('mobile')
@Controller('api/v1/mobile')
export class MobileAppVersionController {
  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  @Public()
  @Get('app-version-policy')
  @ApiOkResponse({ description: 'Minimum / recommended mobile version codes' })
  getPolicy(): {
    minimumSupportedVersionCode: number;
    latestRecommendedVersionCode: number;
    storeUrl: string;
    message: string | null;
  } {
    return {
      minimumSupportedVersionCode: this.env.MOBILE_MIN_VERSION_CODE,
      latestRecommendedVersionCode: this.env.MOBILE_LATEST_VERSION_CODE,
      storeUrl: this.env.MOBILE_STORE_URL,
      message: this.env.MOBILE_REQUIRED_UPDATE_MESSAGE || null,
    };
  }
}
