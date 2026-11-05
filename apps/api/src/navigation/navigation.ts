import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isExternalHref, LABELS, listQuerySchema, NAVIGATION_MENU_KEYS, navigationItemInputSchema, PERMISSIONS, type NavigationMenuKey } from '@asva/shared';
import { z } from 'zod';
import { createCrudController, CrudService, type CrudOptions } from '../common/crud.js';
import { Public } from '../common/decorators.js';

type Input = z.output<typeof navigationItemInputSchema>;

@Injectable()
export class NavigationService extends CrudService<Input> {
  protected readonly options: CrudOptions = {
    model: 'navigationItem',
    entity: 'navigation_item',
    label: 'Navigation item',
    tags: ['navigation'],
    searchFields: ['label', 'href'],
    orderBy: [{ menu: { key: 'asc' } }, { displayOrder: 'asc' }],
    include: { menu: { select: { key: true, name: true } } },
  };

  private async menuId(key: NavigationMenuKey) {
    const menu = await this.prisma.navigationMenu.upsert({ where: { key }, create: { key, name: LABELS.navigationMenu[key] }, update: {} });
    return menu.id;
  }

  /** Hrefs are validated by the shared schema (no javascript:, data: or protocol-relative URLs). */
  protected override async toData(input: Input) {
    const { menu, ...rest } = input;
    return { ...rest, menuId: await this.menuId(menu), isExternal: isExternalHref(input.href) };
  }

  protected override toDto(row: { menu: { key: string } } & Record<string, unknown>) {
    return { ...row, menu: row.menu.key };
  }

  protected override listWhere(query: Record<string, string | undefined>) {
    return { ...super.listWhere(query), ...(query.menu ? { menu: { key: query.menu } } : {}) };
  }

  async listPublic() {
    const menus = await this.prisma.navigationMenu.findMany({
      include: { items: { where: { isVisible: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, label: true, href: true, isExternal: true, openInNewTab: true } } },
    });
    return Object.fromEntries(NAVIGATION_MENU_KEYS.map((key) => [key, menus.find((m) => m.key === key)?.items ?? []]));
  }
}

@ApiTags('Navigation')
@Controller('navigation')
export class NavigationPublicController {
  constructor(private readonly navigation: NavigationService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Visible items of every navigation menu' })
  list() {
    return this.navigation.listPublic();
  }
}

@Module({
  providers: [NavigationService],
  controllers: [
    NavigationPublicController,
    createCrudController({
      path: 'navigation',
      tag: 'Navigation',
      permission: PERMISSIONS.NAVIGATION_MANAGE,
      inputSchema: navigationItemInputSchema,
      querySchema: listQuerySchema.extend({ menu: z.enum(NAVIGATION_MENU_KEYS).optional(), pageSize: z.coerce.number().int().min(1).max(200).default(100) }),
      service: NavigationService,
    }),
  ],
})
export class NavigationModule {}
