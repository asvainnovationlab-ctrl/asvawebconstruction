import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SETTINGS,
  PRIVATE_SETTINGS_GROUPS,
  SETTINGS_GROUPS,
  SETTINGS_SCHEMAS,
  type SettingsGroup,
  type SettingsValues,
} from '@asva/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { parseOrThrow } from '../common/zod.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { MEDIA_SELECT, MediaUrlService } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merges stored values over defaults so new settings fields get sensible values. */
function mergeDefaults(defaults: unknown, stored: unknown): unknown {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return stored === undefined ? defaults : stored;
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored)) result[key] = mergeDefaults(defaults[key], value);
  return result;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
    private readonly mediaUrl: MediaUrlService,
  ) {}

  async getGroup<G extends SettingsGroup>(group: G): Promise<SettingsValues[G]> {
    const row = await this.prisma.siteSetting.findUnique({ where: { group } });
    return this.normalise(group, row?.value);
  }

  async getAll(): Promise<SettingsValues> {
    const rows = await this.prisma.siteSetting.findMany();
    const byGroup = new Map(rows.map((r) => [r.group, r.value]));
    return Object.fromEntries(SETTINGS_GROUPS.map((g) => [g, this.normalise(g, byGroup.get(g))])) as SettingsValues;
  }

  /** Everything the public website needs, with media references resolved to URLs. */
  async getPublic() {
    const all = await this.getAll();
    const publicSettings = Object.fromEntries(
      SETTINGS_GROUPS.filter((g) => !PRIVATE_SETTINGS_GROUPS.includes(g)).map((g) => [g, all[g]]),
    ) as Omit<SettingsValues, 'notifications'>;

    const { branding, home } = publicSettings;
    const ids = [branding.logoForDarkBgId, branding.logoForLightBgId, branding.logoIconId, branding.faviconId, branding.ogImageId, home.hero.imageId].filter(
      (id): id is string => Boolean(id),
    );
    const assets = ids.length ? await this.prisma.mediaAsset.findMany({ where: { id: { in: ids } }, select: MEDIA_SELECT }) : [];
    const media = (id: string | null) => this.mediaUrl.dto(assets.find((a) => a.id === id));

    return {
      ...publicSettings,
      media: {
        logoForDarkBg: media(branding.logoForDarkBgId),
        logoForLightBg: media(branding.logoForLightBgId),
        logoIcon: media(branding.logoIconId),
        favicon: media(branding.faviconId),
        ogImage: media(branding.ogImageId),
        heroImage: media(home.hero.imageId),
      },
    };
  }

  async update(group: SettingsGroup, value: unknown, actor: Principal, meta: RequestMeta) {
    const parsed = parseOrThrow(SETTINGS_SCHEMAS[group], value) as Prisma.InputJsonValue;
    const before = await this.getGroup(group);
    await this.prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { group },
        create: { group, value: parsed, isPublic: !PRIVATE_SETTINGS_GROUPS.includes(group), updatedById: actor.id },
        update: { value: parsed, updatedById: actor.id },
      });
      const changedKeys = Object.keys(parsed as object).filter(
        (k) => JSON.stringify((parsed as Record<string, unknown>)[k]) !== JSON.stringify((before as Record<string, unknown>)[k]),
      );
      await this.audit.log({ actor, action: 'settings.updated', targetType: 'SiteSetting', targetId: group, metadata: { group, changedKeys }, meta }, tx);
    });
    this.revalidation.revalidate('settings');
    return this.getGroup(group);
  }

  private normalise<G extends SettingsGroup>(group: G, stored: unknown): SettingsValues[G] {
    const merged = mergeDefaults(DEFAULT_SETTINGS[group], stored);
    const result = SETTINGS_SCHEMAS[group].safeParse(merged);
    if (result.success) return result.data as SettingsValues[G];
    this.logger.warn({ group, issues: result.error.issues.slice(0, 5) }, 'Stored settings are invalid; falling back to defaults');
    return DEFAULT_SETTINGS[group];
  }
}
