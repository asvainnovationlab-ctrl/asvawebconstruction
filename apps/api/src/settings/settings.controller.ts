import { Body, Controller, Get, Header, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, settingsUpdateSchema, type SettingsGroup } from '@asva/shared';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, createZodDto } from '../common/zod.js';
import { SettingsService } from './settings.service.js';

class SettingsUpdateDto extends createZodDto(settingsUpdateSchema) {}

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  @ApiOperation({ summary: 'Public website settings (no private groups, media resolved to URLs)' })
  getPublic() {
    return this.settings.getPublic();
  }

  @Get('admin/settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'All settings groups, including private notification settings' })
  getAll() {
    return this.settings.getAll();
  }

  @Patch('admin/settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiZodBody(SettingsUpdateDto)
  @ApiOperation({ summary: 'Replace one settings group; the value is validated against that group’s schema' })
  update(@Body() body: SettingsUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.settings.update(body.group as SettingsGroup, body.value, user, requestMeta(req));
  }
}
