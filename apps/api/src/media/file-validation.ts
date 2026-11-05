import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import type { Env } from '../config/env.js';

export type UploadKind = 'image' | 'library' | 'resume' | 'attachment';

interface FileRule {
  label: string;
  extensions: string[];
  maxBytes: number;
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
const DOC_EXT = ['pdf', 'doc', 'docx'];
const OFFICE_EXT = ['xlsx', 'pptx'];

/** Maps file-type detection results to the extensions they may legitimately carry. */
const DETECTED_TO_EXT: Record<string, string[]> = {
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
  webp: ['webp'],
  avif: ['avif'],
  gif: ['gif'],
  pdf: ['pdf'],
  docx: ['docx'],
  xlsx: ['xlsx'],
  pptx: ['pptx'],
  cfb: ['doc'], // legacy Word documents are OLE compound files
};

export function rulesFor(kind: UploadKind, env: Env): FileRule {
  const mb = (n: number) => Math.round(n * 1024 * 1024);
  switch (kind) {
    case 'image':
      return { label: 'JPG, PNG, WebP, AVIF or GIF image', extensions: IMAGE_EXT, maxBytes: mb(env.MEDIA_MAX_IMAGE_MB) };
    case 'library':
      return { label: 'image, PDF or Office document', extensions: [...IMAGE_EXT, ...DOC_EXT, ...OFFICE_EXT], maxBytes: mb(Math.max(env.MEDIA_MAX_IMAGE_MB, env.MEDIA_MAX_DOCUMENT_MB)) };
    case 'resume':
      return { label: 'PDF or Word document', extensions: DOC_EXT, maxBytes: mb(env.RESUME_MAX_MB) };
    case 'attachment':
      return { label: 'PDF, Word, Excel, PowerPoint or image file', extensions: [...DOC_EXT, ...OFFICE_EXT, 'jpg', 'jpeg', 'png', 'webp'], maxBytes: mb(env.MEDIA_MAX_DOCUMENT_MB) };
  }
}

export interface ValidatedFile {
  extension: string;
  mimeType: string;
  isImage: boolean;
}

/**
 * Validates an upload by its actual bytes, not the client-supplied name or MIME type.
 * SVG, HTML, scripts and executables are never accepted (they are not in any allow-list and
 * fail magic-byte detection).
 */
export async function validateUpload(file: { buffer: Buffer; originalname: string; size: number } | undefined, kind: UploadKind, env: Env): Promise<ValidatedFile> {
  if (!file || !file.buffer?.length) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Please choose a file to upload.' });
  const rule = rulesFor(kind, env);
  if (file.size > rule.maxBytes) {
    throw new PayloadTooLargeException({ code: 'FILE_TOO_LARGE', message: `The file is too large. The maximum size is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.` });
  }

  const declared = file.originalname.toLowerCase().split('.').pop() ?? '';
  if (!rule.extensions.includes(declared)) {
    throw new UnsupportedMediaTypeException({ code: 'FILE_TYPE_NOT_ALLOWED', message: `Unsupported file type. Please upload a ${rule.label}.` });
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  const legit = detected ? DETECTED_TO_EXT[detected.ext] : undefined;
  if (!detected || !legit || !legit.includes(declared)) {
    throw new UnsupportedMediaTypeException({ code: 'FILE_CONTENT_MISMATCH', message: `The file content does not match a ${rule.label}.` });
  }

  const mimeType = detected.ext === 'cfb' ? 'application/msword' : detected.mime;
  const extension = detected.ext === 'cfb' ? 'doc' : detected.ext;
  return { extension, mimeType, isImage: mimeType.startsWith('image/') };
}

/** Removes characters that are unsafe in Content-Disposition headers and file systems. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
  return cleaned || 'file';
}
