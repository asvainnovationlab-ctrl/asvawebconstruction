import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootstrap, createUser, login, type Session } from './helpers.js';

describe('Media library', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let editor: Session;
  let png: Buffer;

  beforeAll(async () => {
    ({ app, prisma } = await bootstrap());
    editor = await login(app, (await createUser(prisma, ['EDITOR'])).email);
    png = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#3B82F6' } }).png().toBuffer();
  });
  afterAll(async () => app.close());

  it('uploads an image, records dimensions and serves it publicly with safe headers', async () => {
    const res = await editor.post('/api/v1/admin/media').field('altText', 'Blue box').attach('file', png, { filename: 'box.png', contentType: 'image/png' }).expect(201);
    expect(res.body.data).toMatchObject({ mimeType: 'image/png', width: 64, height: 32, altText: 'Blue box' });
    expect(res.body.data).not.toHaveProperty('storageKey');
    const file = await request(app.getHttpServer()).get(res.body.data.url).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['cache-control']).toMatch(/immutable/);
  });

  it('rejects SVG, HTML and spoofed files', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await editor.post('/api/v1/admin/media').attach('file', svg, { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(415);
    await editor.post('/api/v1/admin/media').attach('file', Buffer.from('<html></html>'), { filename: 'x.html', contentType: 'text/html' }).expect(415);
    const spoof = await editor.post('/api/v1/admin/media').attach('file', Buffer.from('not really a png'), { filename: 'fake.png', contentType: 'image/png' }).expect(415);
    expect(spoof.body.error.code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('blocks deleting media that is in use, and deletes unused media', async () => {
    const upload = await editor.post('/api/v1/admin/media').attach('file', png, { filename: 'cover.png', contentType: 'image/png' }).expect(201);
    const mediaId = upload.body.data.id;
    await editor
      .post('/api/v1/admin/services')
      .send({ name: 'With Cover', slug: 'with-cover', shortDescription: 'Has a cover image', coverImageId: mediaId })
      .expect(201);
    const blocked = await editor.del(`/api/v1/admin/media/${mediaId}`).expect(409);
    expect(blocked.body.error.code).toBe('MEDIA_IN_USE');

    const unused = await editor.post('/api/v1/admin/media').attach('file', png, { filename: 'unused.png', contentType: 'image/png' }).expect(201);
    await editor.del(`/api/v1/admin/media/${unused.body.data.id}`).expect(204);
    await request(app.getHttpServer()).get(`/api/v1/media/files/${unused.body.data.id}`).expect(404);
  });

  it('replaces a file while keeping the same id', async () => {
    const upload = await editor.post('/api/v1/admin/media').attach('file', png, { filename: 'v1.png', contentType: 'image/png' }).expect(201);
    const bigger = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#06B6D4' } }).png().toBuffer();
    const replaced = await editor.post(`/api/v1/admin/media/${upload.body.data.id}/replace`).attach('file', bigger, { filename: 'v2.png', contentType: 'image/png' }).expect(201);
    expect(replaced.body.data).toMatchObject({ id: upload.body.data.id, width: 128, originalName: 'v2.png' });
    expect(replaced.body.data.url).not.toBe(upload.body.data.url);
  });
});
