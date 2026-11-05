import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminContentQuerySchema, PERMISSIONS, reorderSchema, serviceInputSchema } from '@asva/shared';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { ServicesService } from './services.service.js';

class ServiceDto extends createZodDto(serviceInputSchema) {}
class AdminQueryDto extends createZodDto(adminContentQuerySchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

@ApiTags('Services')
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get('services')
  @ApiOperation({ summary: 'Published services in display order' })
  listPublic() {
    return this.services.listPublic();
  }

  @Public()
  @Get('services/:slug')
  @ApiOperation({ summary: 'A published service with related services' })
  getPublic(@Param('slug') slug: string) {
    return this.services.getPublic(slug);
  }

  @Get('admin/services')
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  @ApiZodQuery(AdminQueryDto)
  list(@Query() query: AdminQueryDto) {
    return this.services.list(query);
  }

  @Get('admin/services/:id')
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.get(id);
  }

  @Post('admin/services')
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  @ApiZodBody(ServiceDto)
  create(@Body() body: ServiceDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.services.create(body, user, requestMeta(req));
  }

  @Post('admin/services/reorder')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  @ApiZodBody(ReorderDto)
  async reorder(@Body() body: ReorderDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.services.reorder(body, user, requestMeta(req));
  }

  @Patch('admin/services/:id')
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  @ApiZodBody(ServiceDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: ServiceDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.services.update(id, body, user, requestMeta(req));
  }

  @Delete('admin/services/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.SERVICES_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.services.remove(id, user, requestMeta(req));
  }
}
