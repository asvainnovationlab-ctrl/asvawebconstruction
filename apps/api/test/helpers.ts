import type { INestApplication } from '@nestjs/common';
import argon2 from 'argon2';
import request from 'supertest';
import type { RoleKey } from '@asva/shared';
import { createApp } from '../src/app.factory.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const PASSWORD = 'Integration-Test-Pa55!';
export const ORIGIN = 'http://localhost:3000';

export async function bootstrap() {
  const app = await createApp();
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

let counter = 0;

/** Creates an active user with the given roles and a known password. */
export async function createUser(prisma: PrismaService, roles: RoleKey[], overrides: { email?: string; isActive?: boolean } = {}) {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@test.local`;
  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } } });
  return prisma.adminUser.create({
    data: {
      email,
      name: `Test ${roles.join('+') || 'NoRole'} ${counter}`,
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1 }),
      isActive: overrides.isActive ?? true,
      emailVerifiedAt: new Date(),
      roles: { create: roleRows.map((r) => ({ roleId: r.id })) },
    },
  });
}

function cookieValue(setCookie: string[] | string | undefined, name: string): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = list.find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.split(';')[0]!.slice(name.length + 1)) : undefined;
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  /** Convenience wrappers that add the CSRF header and Origin. */
  post: (url: string) => request.Test;
  patch: (url: string) => request.Test;
  del: (url: string) => request.Test;
}

export async function login(app: INestApplication, email: string, password = PASSWORD): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email, password }).expect(200);
  const csrf = cookieValue(res.headers['set-cookie'], 'asva_csrf')!;
  return {
    agent,
    csrf,
    post: (url) => agent.post(url).set('Origin', ORIGIN).set('x-csrf-token', csrf),
    patch: (url) => agent.patch(url).set('Origin', ORIGIN).set('x-csrf-token', csrf),
    del: (url) => agent.delete(url).set('Origin', ORIGIN).set('x-csrf-token', csrf),
  };
}

export { cookieValue };
