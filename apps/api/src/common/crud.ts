import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  type Type,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { listQuerySchema, reorderSchema, type PermissionKey, type ReorderInput } from '@asva/shared';
import type { ZodObject, ZodType } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { RevalidationService, type CacheTag } from '../revalidation/revalidation.service.js';
import { CurrentUser, RequirePermissions } from './decorators.js';
import { paginate, pageArgs, searchFilter } from './http.js';
import { requestMeta, type AppRequest, type Principal, type RequestMeta } from './types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from './zod.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany(args: any): Promise<any[]>;
  findUnique(args: any): Promise<any>;
  count(args: any): Promise<number>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
};

export interface CrudOptions {
  /** Prisma model accessor, e.g. 'technology'. */
  model: string;
  /** Audit action prefix and human label, e.g. 'technology'. */
  entity: string;
  label: string;
  tags: CacheTag[];
  searchFields: string[];
  orderBy: any;
  include?: any;
  reorderable?: boolean;
}

/**
 * Shared admin CRUD behaviour for simple content types: pagination, search, audit logging,
 * cache revalidation and transactional writes. Subclasses customise via the hooks.
 */
@Injectable()
export abstract class CrudService<TInput extends Record<string, any> = Record<string, any>> {
  protected abstract readonly options: CrudOptions;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditService,
    protected readonly revalidation: RevalidationService,
  ) {}

  protected delegate(db: PrismaService | Tx = this.prisma): Delegate {
    return (db as any)[this.options.model] as Delegate;
  }

  /** Converts validated input into Prisma data. */
  protected async toData(input: TInput, _existing: any | null, _actor: Principal): Promise<Record<string, any>> {
    return input;
  }

  /** Shapes a row for the admin API. */
  protected toDto(row: any): any {
    return row;
  }

  /** Throw to block a deletion (e.g. when records are still linked). */
  protected async beforeDelete(_row: any): Promise<void> {}

  protected async afterWrite(_tx: Tx, _row: any, _input: TInput, _existing: any | null): Promise<void> {}

  protected listWhere(query: Record<string, any>): Record<string, any> {
    return searchFilter(query.q, this.options.searchFields) ?? {};
  }

  async list(query: { page: number; pageSize: number; q?: string } & Record<string, any>) {
    const where = this.listWhere(query);
    const [items, total] = await Promise.all([
      this.delegate().findMany({ where, orderBy: this.options.orderBy, include: this.options.include, ...pageArgs(query) }),
      this.delegate().count({ where }),
    ]);
    return paginate(items.map((i) => this.toDto(i)), total, query.page, query.pageSize);
  }

  async get(id: string) {
    const row = await this.delegate().findUnique({ where: { id }, include: this.options.include });
    if (!row) throw new NotFoundException(`${this.options.label} not found`);
    return this.toDto(row);
  }

  async create(input: TInput, actor: Principal, meta: RequestMeta) {
    const data = await this.toData(input, null, actor);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await this.delegate(tx).create({ data });
      await this.afterWrite(tx, created, input, null);
      await this.audit.log({ actor, action: `${this.options.entity}.created`, targetType: this.options.label, targetId: created.id, meta }, tx);
      return created;
    });
    this.revalidation.revalidate(...this.options.tags);
    return this.get(row.id);
  }

  async update(id: string, input: TInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.delegate().findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${this.options.label} not found`);
    const data = await this.toData(input, existing, actor);
    await this.prisma.$transaction(async (tx) => {
      const updated = await this.delegate(tx).update({ where: { id }, data });
      await this.afterWrite(tx, updated, input, existing);
      await this.audit.log({ actor, action: `${this.options.entity}.updated`, targetType: this.options.label, targetId: id, meta }, tx);
    });
    this.revalidation.revalidate(...this.options.tags);
    return this.get(id);
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const existing = await this.delegate().findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${this.options.label} not found`);
    await this.beforeDelete(existing);
    await this.prisma.$transaction(async (tx) => {
      await this.delegate(tx).delete({ where: { id } });
      await this.audit.log({ actor, action: `${this.options.entity}.deleted`, targetType: this.options.label, targetId: id, meta }, tx);
    });
    this.revalidation.revalidate(...this.options.tags);
  }

  async reorder(input: ReorderInput, actor: Principal, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) await this.delegate(tx).update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } });
      await this.audit.log({ actor, action: `${this.options.entity}.reordered`, targetType: this.options.label, metadata: { count: input.items.length }, meta }, tx);
    });
    this.revalidation.revalidate(...this.options.tags);
  }
}

interface CrudControllerOptions {
  path: string;
  tag: string;
  permission: PermissionKey;
  inputSchema: ZodType;
  querySchema?: ZodObject;
  service: Type<CrudService<any>>;
}

/** Generates a permission-guarded, Swagger-documented admin CRUD controller at /admin/{path}. */
export function createCrudController(options: CrudControllerOptions): Type<unknown> {
  class InputDto {
    static zodSchema: ZodType = options.inputSchema;
  }
  class QueryDto {
    static zodSchema: ZodType = options.querySchema ?? listQuerySchema;
  }
  class ReorderDto extends createZodDto(reorderSchema) {}

  @ApiTags(options.tag)
  @Controller(`admin/${options.path}`)
  class CrudController {
    constructor(@Inject(options.service) readonly service: CrudService<any>) {}

    @Get()
    @RequirePermissions(options.permission)
    @ApiZodQuery(QueryDto as never)
    list(@Query() query: QueryDto) {
      return this.service.list(query as any);
    }

    @Get(':id')
    @RequirePermissions(options.permission)
    get(@Param('id', ParseUUIDPipe) id: string) {
      return this.service.get(id);
    }

    @Post()
    @RequirePermissions(options.permission)
    @ApiZodBody(InputDto as never)
    create(@Body() body: InputDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
      return this.service.create(body as any, user, requestMeta(req));
    }

    @Post('reorder')
    @HttpCode(204)
    @RequirePermissions(options.permission)
    @ApiZodBody(ReorderDto)
    async reorder(@Body() body: ReorderDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
      await this.service.reorder(body as ReorderInput, user, requestMeta(req));
    }

    @Patch(':id')
    @RequirePermissions(options.permission)
    @ApiZodBody(InputDto as never)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() body: InputDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
      return this.service.update(id, body as any, user, requestMeta(req));
    }

    @Delete(':id')
    @HttpCode(204)
    @RequirePermissions(options.permission)
    async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
      await this.service.remove(id, user, requestMeta(req));
    }
  }

  Object.defineProperty(CrudController, 'name', { value: `${options.tag.replace(/\W/g, '')}AdminController` });
  return CrudController;
}
