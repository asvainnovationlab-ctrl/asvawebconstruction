import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from './config/env.js';
import { AuditService } from './audit/audit.service.js';
import { AuthService } from './auth/auth.service.js';
import { PasswordService } from './auth/password.service.js';
import { SpamService } from './common/spam.service.js';
import { EmailService } from './email/email.service.js';
import { NotificationsService } from './email/notifications.service.js';
import { MediaUrlService } from './media/media-url.service.js';
import { MediaService } from './media/media.service.js';
import { createStorage, STORAGE } from './media/storage.js';
import { RedirectsService } from './redirects/redirects.service.js';
import { RevalidationService } from './revalidation/revalidation.service.js';
import { SettingsService } from './settings/settings.service.js';

const providers = [
  AuditService,
  AuthService,
  PasswordService,
  SpamService,
  EmailService,
  NotificationsService,
  MediaUrlService,
  MediaService,
  RedirectsService,
  RevalidationService,
  SettingsService,
];

/** Cross-cutting services shared by every feature module. */
@Global()
@Module({
  providers: [...providers, { provide: STORAGE, inject: [ENV], useFactory: (env: Env) => createStorage(env) }],
  exports: [...providers, STORAGE],
})
export class CoreModule {}
