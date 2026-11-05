import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminContentQuerySchema, PERMISSIONS, projectCategoryInputSchema, projectInputSchema, publicProjectQuerySchema, reorderSchema } from '@asva/shared';
import { createCrudController } from '../common/crud.js';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { ProjectCategoriesService, ProjectsService } from './projects.service.js';

class ProjectDto extends createZodDto(projectInputSchema) {}
class PublicQueryDto extends createZodDto(publicProjectQuerySchema) {}
class AdminQueryDto extends createZodDto(adminContentQuerySchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

@ApiTags('Projects')
@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly categories: ProjectCategoriesService,
  ) {}

  @Public()
  @Get('projects')
  @ApiZodQuery(PublicQueryDto)
  @ApiOperation({ summary: 'Published projects with category, technology, featured and text filters' })
  listPublic(@Query() query: PublicQueryDto) {
    return this.projects.listPublic(query);
  }

  @Public()
  @Get('project-categories')
  @ApiOperation({ summary: 'Categories that contain at least one published project' })
  categoriesPublic() {
    return this.categories.listPublic();
  }

  @Public()
  @Get('projects/:slug')
  @ApiOperation({ summary: 'A published project case study with related projects' })
  getPublic(@Param('slug') slug: string) {
    return this.projects.getPublic(slug);
  }

  @Get('admin/projects')
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  @ApiZodQuery(AdminQueryDto)
  list(@Query() query: AdminQueryDto) {
    return this.projects.list(query);
  }

  @Get('admin/projects/:id')
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(id);
  }

  @Post('admin/projects')
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  @ApiZodBody(ProjectDto)
  create(@Body() body: ProjectDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.projects.create(body, user, requestMeta(req));
  }

  @Post('admin/projects/reorder')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  @ApiZodBody(ReorderDto)
  async reorder(@Body() body: ReorderDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.projects.reorder(body, user, requestMeta(req));
  }

  @Patch('admin/projects/:id')
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  @ApiZodBody(ProjectDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: ProjectDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.projects.update(id, body, user, requestMeta(req));
  }

  @Delete('admin/projects/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.projects.remove(id, user, requestMeta(req));
  }
}

@Module({
  providers: [ProjectsService, ProjectCategoriesService],
  controllers: [
    ProjectsController,
    createCrudController({ path: 'project-categories', tag: 'Project categories', permission: PERMISSIONS.PROJECTS_MANAGE, inputSchema: projectCategoryInputSchema, service: ProjectCategoriesService }),
  ],
})
export class ProjectsModule {}
