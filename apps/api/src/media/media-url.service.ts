import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

/** Fields needed to describe a media asset publicly. Use with `select: MEDIA_SELECT`. */
export const MEDIA_SELECT = {
  id: true,
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  altText: true,
  caption: true,
  checksum: true,
  visibility: true,
} as const;

export interface MediaRef {
  id: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  checksum: string;
  visibility: 'PUBLIC' | 'PRIVATE';
}

export interface MediaDto {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
}

@Injectable()
export class MediaUrlService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Public URL for a PUBLIC asset. Includes a content version so caches can be immutable. */
  url(asset: Pick<MediaRef, 'id' | 'storageKey' | 'checksum'>): string {
    if (this.env.STORAGE_PROVIDER === 's3' && this.env.STORAGE_PUBLIC_URL) {
      return `${this.env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${asset.storageKey}`;
    }
    return `/api/v1/media/files/${asset.id}/${asset.checksum.slice(0, 12)}`;
  }

  dto(asset: MediaRef | null | undefined): MediaDto | null {
    if (!asset || asset.visibility !== 'PUBLIC') return null;
    return {
      id: asset.id,
      url: this.url(asset),
      alt: asset.altText ?? '',
      caption: asset.caption,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
    };
  }
}
