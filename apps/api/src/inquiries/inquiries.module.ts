import { Body, Controller, Delete, Get, Header, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { inquiryNoteSchema, inquiryQuerySchema, inquiryUpdateSchema, PERMISSIONS, projectInquirySchema } from '@asva/shared';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { RawResponse, UTF8_BOM } from '../common/http.js';
import { readPayload } from '../common/multipart.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto, parseOrThrow } from '../common/zod.js';
import { sendFile, UPLOAD_LIMITS } from '../media/media.controller.js';
import { MediaService, type UploadedFile as Upload } from '../media/media.service.js';
import { InquiriesService } from './inquiries.service.js';

class InquiryUpdateDto extends createZodDto(inquiryUpdateSchema) {}
class InquiryNoteDto extends createZodDto(inquiryNoteSchema) {}
class InquiryQueryDto extends createZodDto(inquiryQuerySchema) {}

@ApiTags('Project inquiries')
@Controller()
export class InquiriesController {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly media: MediaService,
  ) {}

  @Public()
  @Post('inquiries')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @UseInterceptors(FileInterceptor('attachment', UPLOAD_LIMITS))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ schema: { type: 'object', properties: { payload: { type: 'string', description: 'JSON-encoded inquiry fields' }, attachment: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Submit a project inquiry with an optional attachment (PDF, Office or image, max 10 MB)' })
  submit(@Body() body: unknown, @UploadedFile() file: Upload | undefined, @Req() req: AppRequest) {
    const input = parseOrThrow(projectInquirySchema, readPayload(body));
    return this.inquiries.submit(input, file, req.ip ?? null);
  }

  @Get('admin/inquiries')
  @RequirePermissions(PERMISSIONS.INQUIRIES_READ)
  @ApiZodQuery(InquiryQueryDto)
  list(@Query() query: InquiryQueryDto) {
    return this.inquiries.list(query);
  }

  @Get('admin/inquiries/export')
  @RequirePermissions(PERMISSIONS.INQUIRIES_EXPORT)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiZodQuery(InquiryQueryDto)
  @ApiOperation({ summary: 'Export leads matching the filters as CSV (audited)' })
  async export(@Query() query: InquiryQueryDto, @CurrentUser() user: Principal, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    return new RawResponse(UTF8_BOM + (await this.inquiries.exportCsv(query, user, requestMeta(req))));
  }

  @Get('admin/inquiries/:id')
  @RequirePermissions(PERMISSIONS.INQUIRIES_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.inquiries.get(id);
  }

  @Patch('admin/inquiries/:id')
  @RequirePermissions(PERMISSIONS.INQUIRIES_UPDATE)
  @ApiZodBody(InquiryUpdateDto)
  @ApiOperation({ summary: 'Change lead status (validated transitions) and/or assignment' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: InquiryUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.inquiries.update(id, body, user, requestMeta(req));
  }

  @Post('admin/inquiries/:id/notes')
  @RequirePermissions(PERMISSIONS.INQUIRIES_UPDATE)
  @ApiZodBody(InquiryNoteDto)
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body() body: InquiryNoteDto, @CurrentUser() user: Principal) {
    return this.inquiries.addNote(id, body.body, user);
  }

  @Get('admin/inquiries/:id/attachment')
  @RequirePermissions(PERMISSIONS.INQUIRIES_READ)
  @ApiOperation({ summary: 'Download the private attachment (audited)' })
  async attachment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const asset = await this.inquiries.attachment(id, user, requestMeta(req));
    return sendFile(this.media, asset, res, { inline: false, cache: 'private, no-store' });
  }

  @Delete('admin/inquiries/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.INQUIRIES_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.inquiries.remove(id, user, requestMeta(req));
  }
}

@Module({ providers: [InquiriesService], controllers: [InquiriesController] })
export class InquiriesModule {}
