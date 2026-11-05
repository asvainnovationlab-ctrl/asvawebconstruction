import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { mediaQuerySchema, mediaUpdateSchema, PERMISSIONS } from '@asva/shared';
import { MediaPurpose, MediaVisibility, type MediaAsset } from '../generated/prisma/client.js';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { sanitizeFileName } from './file-validation.js';
import { MediaService, type UploadedFile as Upload } from './media.service.js';

class MediaQueryDto extends createZodDto(mediaQuerySchema) {}
class MediaUpdateDto extends createZodDto(mediaUpdateSchema) {}

/** Multer keeps uploads in memory with a hard cap; precise per-type limits are enforced after detection. */
export const UPLOAD_LIMITS = { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 20 } };

const uploadBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, altText: { type: 'string' } }, required: ['file'] },
};

/** Streams a stored file with headers that prevent content sniffing and script execution. */
export async function sendFile(media: MediaService, asset: MediaAsset, res: Response, options: { inline: boolean; cache: string }) {
  const { stream, size } = await media.open(asset);
  res.setHeader('Cache-Control', options.cache);
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  const filename = sanitizeFileName(asset.originalName);
  return new StreamableFile(stream, {
    type: asset.mimeType,
    length: size,
    disposition: `${options.inline ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

@ApiTags('Media')
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @SkipThrottle()
  @Get('media/files/:id')
  @ApiOperation({ summary: 'Serve a public media file' })
  async publicFile(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const asset = await this.media.findPublic(id);
    return sendFile(this.media, asset, res, { inline: asset.mimeType.startsWith('image/') || asset.mimeType === 'application/pdf', cache: 'public, max-age=3600' });
  }

  @Public()
  @SkipThrottle()
  @Get('media/files/:id/:version')
  @ApiOperation({ summary: 'Serve a public media file (versioned URL, cached immutably)' })
  async publicVersionedFile(@Param('id', ParseUUIDPipe) id: string, @Param('version') version: string, @Res({ passthrough: true }) res: Response) {
    const asset = await this.media.findPublic(id);
    const current = asset.checksum.startsWith(version);
    return sendFile(this.media, asset, res, {
      inline: asset.mimeType.startsWith('image/') || asset.mimeType === 'application/pdf',
      cache: current ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    });
  }

  @Post('admin/media')
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBody)
  @ApiOperation({ summary: 'Upload an image or document to the media library' })
  async upload(@UploadedFile() file: Upload, @Body('altText') altText: string | undefined, @CurrentUser() user: Principal) {
    const asset = await this.media.upload(file, {
      kind: 'library',
      purpose: MediaPurpose.LIBRARY,
      visibility: MediaVisibility.PUBLIC,
      uploadedById: user.id,
      altText: altText?.slice(0, 250) || null,
    });
    return this.media.get(asset.id);
  }

  @Get('admin/media')
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @ApiZodQuery(MediaQueryDto)
  list(@Query() query: MediaQueryDto) {
    return this.media.list(query);
  }

  @Get('admin/media/:id')
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @ApiOperation({ summary: 'Media details, including where the file is used' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.get(id);
  }

  @Patch('admin/media/:id')
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @ApiZodBody(MediaUpdateDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: MediaUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.media.update(id, body, user, requestMeta(req));
  }

  @Post('admin/media/:id/replace')
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBody)
  @ApiOperation({ summary: 'Replace the file while keeping every reference to it' })
  replace(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Upload, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.media.replace(id, file, user, requestMeta(req));
  }

  @Delete('admin/media/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.MEDIA_MANAGE)
  @ApiOperation({ summary: 'Delete a file that is not used anywhere' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.media.remove(id, user, requestMeta(req));
  }
}
