import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminContentQuerySchema, pageInputSchema, PERMISSIONS } from '@asva/shared';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { PagesService } from './pages.service.js';

class PageDto extends createZodDto(pageInputSchema) {}
class AdminQueryDto extends createZodDto(adminContentQuerySchema) {}

@ApiTags('Pages')
@Controller()
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Public()
  @Get('pages')
  @ApiOperation({ summary: 'Published, indexable pages (slug and title)' })
  listPublic() {
    return this.pages.listPublic();
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'A published page by slug' })
  getPublic(@Param('slug') slug: string) {
    return this.pages.getPublic(slug);
  }

  @Get('admin/pages')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  @ApiZodQuery(AdminQueryDto)
  list(@Query() query: AdminQueryDto) {
    return this.pages.list(query);
  }

  @Get('admin/pages/:id')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  @ApiOperation({ summary: 'Any page including drafts, with revision history (used for preview)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pages.get(id);
  }

  @Post('admin/pages')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  @ApiZodBody(PageDto)
  create(@Body() body: PageDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.pages.create(body, user, requestMeta(req));
  }

  @Patch('admin/pages/:id')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  @ApiZodBody(PageDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: PageDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.pages.update(id, body, user, requestMeta(req));
  }

  @Delete('admin/pages/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.pages.remove(id, user, requestMeta(req));
  }

  @Get('admin/pages/:id/revisions/:revisionId')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  revision(@Param('id', ParseUUIDPipe) id: string, @Param('revisionId', ParseUUIDPipe) revisionId: string) {
    return this.pages.getRevision(id, revisionId);
  }

  @Post('admin/pages/:id/revisions/:revisionId/restore')
  @RequirePermissions(PERMISSIONS.PAGES_MANAGE)
  restore(@Param('id', ParseUUIDPipe) id: string, @Param('revisionId', ParseUUIDPipe) revisionId: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.pages.restoreRevision(id, revisionId, user, requestMeta(req));
  }
}
