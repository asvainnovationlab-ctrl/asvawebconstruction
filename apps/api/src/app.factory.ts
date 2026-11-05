import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { allowedOrigins, ENV, type Env } from './config/env.js';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'", "'unsafe-inline'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: allowedOrigins(env),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Asva Innovation Lab API')
      .setDescription(
        'REST API for the Asva Innovation Lab website and CMS. Public endpoints return published content only. ' +
          'Admin endpoints (/admin/*) require an authenticated session (HttpOnly cookies from POST /auth/login), ' +
          'the X-CSRF-Token header on unsafe methods, and the permission listed in each endpoint.',
      )
      .setVersion('1.0')
      .addCookieAuth('asva_at')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'api/docs-json' });
  }
  return app;
}
