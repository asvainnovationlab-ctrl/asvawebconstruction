import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { applicationQuerySchema, applicationUpdateSchema, JOB_STATUSES, jobApplicationSchema, jobInputSchema, listQuerySchema, PERMISSIONS } from '@asva/shared';
import { z } from 'zod';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { readPayload } from '../common/multipart.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto, parseOrThrow } from '../common/zod.js';
import { sendFile, UPLOAD_LIMITS } from '../media/media.controller.js';
import { MediaService, type UploadedFile as Upload } from '../media/media.service.js';
import { CareersService } from './careers.service.js';

class JobDto extends createZodDto(jobInputSchema) {}
class JobQueryDto extends createZodDto(listQuerySchema.extend({ status: z.enum(JOB_STATUSES).optional() })) {}
class ApplicationUpdateDto extends createZodDto(applicationUpdateSchema) {}
class ApplicationQueryDto extends createZodDto(applicationQuerySchema) {}

const applicationBody = {
  schema: {
    type: 'object',
    properties: { payload: { type: 'string', description: 'JSON-encoded application fields' }, resume: { type: 'string', format: 'binary', description: 'PDF, DOC or DOCX, max 5 MB' } },
    required: ['payload', 'resume'],
  },
};

@ApiTags('Careers')
@Controller()
export class CareersController {
  constructor(
    private readonly careers: CareersService,
    private readonly media: MediaService,
  ) {}

  @Public()
  @Get('jobs')
  @ApiOperation({ summary: 'Open vacancies' })
  listOpen() {
    return this.careers.listOpen();
  }

  @Public()
  @Get('jobs/:slug')
  @ApiOperation({ summary: 'An open vacancy by slug' })
  getOpen(@Param('slug') slug: string) {
    return this.careers.getOpen(slug);
  }

  @Public()
  @Post('jobs/:id/applications')
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  @UseInterceptors(FileInterceptor('resume', UPLOAD_LIMITS))
  @ApiConsumes('multipart/form-data')
  @ApiBody(applicationBody)
  @ApiOperation({ summary: 'Apply for an open vacancy with a CV/resume' })
  apply(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @UploadedFile() file: Upload | undefined, @Req() req: AppRequest) {
    return this.careers.apply(id, parseOrThrow(jobApplicationSchema, readPayload(body)), file, req.ip ?? null);
  }

  @Public()
  @Post('careers/applications')
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  @UseInterceptors(FileInterceptor('resume', UPLOAD_LIMITS))
  @ApiConsumes('multipart/form-data')
  @ApiBody(applicationBody)
  @ApiOperation({ summary: 'Submit a general application (when enabled in settings)' })
  applyGeneral(@Body() body: unknown, @UploadedFile() file: Upload | undefined, @Req() req: AppRequest) {
    return this.careers.apply(null, parseOrThrow(jobApplicationSchema, readPayload(body)), file, req.ip ?? null);
  }

  // ---------------------------------------------------------------- jobs

  @Get('admin/jobs')
  @RequirePermissions(PERMISSIONS.JOBS_MANAGE)
  @ApiZodQuery(JobQueryDto)
  listJobs(@Query() query: JobQueryDto) {
    return this.careers.listJobs(query);
  }

  @Get('admin/jobs/:id')
  @RequirePermissions(PERMISSIONS.JOBS_MANAGE)
  getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.careers.getJob(id);
  }

  @Post('admin/jobs')
  @RequirePermissions(PERMISSIONS.JOBS_MANAGE)
  @ApiZodBody(JobDto)
  createJob(@Body() body: JobDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.careers.createJob(body, user, requestMeta(req));
  }

  @Patch('admin/jobs/:id')
  @RequirePermissions(PERMISSIONS.JOBS_MANAGE)
  @ApiZodBody(JobDto)
  @ApiOperation({ summary: 'Edit a vacancy; status OPEN publishes, CLOSED closes, ARCHIVED archives' })
  updateJob(@Param('id', ParseUUIDPipe) id: string, @Body() body: JobDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.careers.updateJob(id, body, user, requestMeta(req));
  }

  @Delete('admin/jobs/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.JOBS_MANAGE)
  async removeJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.careers.removeJob(id, user, requestMeta(req));
  }

  // ---------------------------------------------------------------- applications

  @Get('admin/applications')
  @RequirePermissions(PERMISSIONS.APPLICATIONS_READ)
  @ApiZodQuery(ApplicationQueryDto)
  listApplications(@Query() query: ApplicationQueryDto) {
    return this.careers.listApplications(query);
  }

  @Get('admin/applications/:id')
  @RequirePermissions(PERMISSIONS.APPLICATIONS_READ)
  getApplication(@Param('id', ParseUUIDPipe) id: string) {
    return this.careers.getApplication(id);
  }

  @Patch('admin/applications/:id')
  @RequirePermissions(PERMISSIONS.APPLICATIONS_UPDATE)
  @ApiZodBody(ApplicationUpdateDto)
  updateApplication(@Param('id', ParseUUIDPipe) id: string, @Body() body: ApplicationUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.careers.updateApplication(id, body, user, requestMeta(req));
  }

  @Get('admin/applications/:id/resume')
  @RequirePermissions(PERMISSIONS.APPLICATIONS_RESUME)
  @ApiOperation({ summary: 'Download the applicant’s resume (audited)' })
  async resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const asset = await this.careers.resume(id, user, requestMeta(req));
    return sendFile(this.media, asset, res, { inline: false, cache: 'private, no-store' });
  }

  @Delete('admin/applications/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.APPLICATIONS_DELETE)
  async removeApplication(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.careers.removeApplication(id, user, requestMeta(req));
  }
}

@Module({ providers: [CareersService], controllers: [CareersController] })
export class CareersModule {}
