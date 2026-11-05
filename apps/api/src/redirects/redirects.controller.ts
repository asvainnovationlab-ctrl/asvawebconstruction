import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { listQuerySchema, PERMISSIONS, redirectInputSchema } from '@asva/shared';
import { z } from 'zod';
import { Public, RequirePermissions } from '../common/decorators.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { RedirectsService } from './redirects.service.js';

class RedirectDto extends createZodDto(redirectInputSchema) {}
class ListDto extends createZodDto(listQuerySchema) {}
class ResolveDto extends createZodDto(z.object({ path: z.string().max(500).startsWith('/') })) {}

@ApiTags('Redirects')
@Controller()
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Public()
  @Get('redirects/resolve')
  @ApiOperation({ summary: 'Resolve an old URL to its new location (used by the web app for 404s)' })
  resolve(@Query() query: ResolveDto) {
    return this.redirects.resolve(query.path);
  }

  @Get('admin/redirects')
  @RequirePermissions(PERMISSIONS.REDIRECTS_MANAGE)
  @ApiZodQuery(ListDto)
  list(@Query() query: ListDto) {
    return this.redirects.list(query);
  }

  @Post('admin/redirects')
  @RequirePermissions(PERMISSIONS.REDIRECTS_MANAGE)
  @ApiZodBody(RedirectDto)
  create(@Body() body: RedirectDto) {
    return this.redirects.create(body);
  }

  @Patch('admin/redirects/:id')
  @RequirePermissions(PERMISSIONS.REDIRECTS_MANAGE)
  @ApiZodBody(RedirectDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: RedirectDto) {
    return this.redirects.update(id, body);
  }

  @Delete('admin/redirects/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.REDIRECTS_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.redirects.remove(id);
  }
}
