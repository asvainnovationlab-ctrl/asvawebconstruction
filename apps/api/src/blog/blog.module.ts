import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminContentQuerySchema,
  authorInputSchema,
  blogCategoryInputSchema,
  blogPostInputSchema,
  blogTagInputSchema,
  PERMISSIONS,
  publicBlogQuerySchema,
} from '@asva/shared';
import { createCrudController } from '../common/crud.js';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { AuthorsService, BlogCategoriesService, BlogService, BlogTagsService } from './blog.service.js';
import { SchedulerService } from './scheduler.service.js';

class PostDto extends createZodDto(blogPostInputSchema) {}
class PublicQueryDto extends createZodDto(publicBlogQuerySchema) {}
class AdminQueryDto extends createZodDto(adminContentQuerySchema) {}

@ApiTags('Blog')
@Controller()
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Public()
  @Get('blog')
  @ApiZodQuery(PublicQueryDto)
  @ApiOperation({ summary: 'Published posts, filterable by category, tag, author, featured and text' })
  listPublic(@Query() query: PublicQueryDto) {
    return this.blog.listPublic(query);
  }

  @Public()
  @Get('blog/taxonomies')
  @ApiOperation({ summary: 'Categories and tags that have published posts' })
  taxonomies() {
    return this.blog.taxonomies();
  }

  @Public()
  @Get('blog/:slug')
  @ApiOperation({ summary: 'A published post with author, tags and related posts' })
  getPublic(@Param('slug') slug: string) {
    return this.blog.getPublic(slug);
  }

  @Get('admin/blog')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  @ApiZodQuery(AdminQueryDto)
  list(@Query() query: AdminQueryDto) {
    return this.blog.list(query);
  }

  @Get('admin/blog/:id')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  @ApiOperation({ summary: 'Any post including drafts and scheduled, with revisions (used for preview)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.get(id);
  }

  @Post('admin/blog')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  @ApiZodBody(PostDto)
  create(@Body() body: PostDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.blog.create(body, user, requestMeta(req));
  }

  @Patch('admin/blog/:id')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  @ApiZodBody(PostDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: PostDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.blog.update(id, body, user, requestMeta(req));
  }

  @Delete('admin/blog/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.blog.remove(id, user, requestMeta(req));
  }

  @Get('admin/blog/:id/revisions/:revisionId')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  revision(@Param('id', ParseUUIDPipe) id: string, @Param('revisionId', ParseUUIDPipe) revisionId: string) {
    return this.blog.getRevision(id, revisionId);
  }

  @Post('admin/blog/:id/revisions/:revisionId/restore')
  @RequirePermissions(PERMISSIONS.BLOG_MANAGE)
  restore(@Param('id', ParseUUIDPipe) id: string, @Param('revisionId', ParseUUIDPipe) revisionId: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.blog.restoreRevision(id, revisionId, user, requestMeta(req));
  }
}

@Module({
  providers: [BlogService, BlogCategoriesService, BlogTagsService, AuthorsService, SchedulerService],
  controllers: [
    BlogController,
    createCrudController({ path: 'blog-categories', tag: 'Blog categories', permission: PERMISSIONS.BLOG_MANAGE, inputSchema: blogCategoryInputSchema, service: BlogCategoriesService }),
    createCrudController({ path: 'blog-tags', tag: 'Blog tags', permission: PERMISSIONS.BLOG_MANAGE, inputSchema: blogTagInputSchema, service: BlogTagsService }),
    createCrudController({ path: 'authors', tag: 'Authors', permission: PERMISSIONS.BLOG_MANAGE, inputSchema: authorInputSchema, service: AuthorsService }),
  ],
  exports: [SchedulerService],
})
export class BlogModule {}
