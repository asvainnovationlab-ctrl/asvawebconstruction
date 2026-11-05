import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

export interface StoredObject {
  stream: Readable;
  size?: number;
}

/** Durable file storage. Keys are generated server-side and never contain user input. */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string, isPublic: boolean): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^(public|private)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
}

/**
 * Local-disk storage for development and single-server deployments with a persistent volume.
 * Files live outside the web root and are only served through the API.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string): string {
    assertValidKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Path traversal blocked');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { flag: 'wx' });
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolve(key);
    const info = await stat(full);
    return { stream: createReadStream(full), size: info.size };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/** Any S3-compatible object store: AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, MinIO. */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;

  constructor(private readonly env: Env) {
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.STORAGE_ACCESS_KEY!, secretAccessKey: env.STORAGE_SECRET_KEY! },
    });
  }

  async put(key: string, body: Buffer, contentType: string, isPublic: boolean): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
      }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    assertValidKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.env.STORAGE_BUCKET, Key: key }));
    return { stream: result.Body as Readable, size: result.ContentLength };
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.env.STORAGE_BUCKET, Key: key }));
  }
}

export const STORAGE = Symbol('STORAGE');

export function createStorage(env: Env): StorageProvider {
  return env.STORAGE_PROVIDER === 's3' ? new S3StorageProvider(env) : new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
}
