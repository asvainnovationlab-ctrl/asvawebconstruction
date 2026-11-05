import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createUserSchema, listQuerySchema, PERMISSIONS, updateUserSchema } from '@asva/shared';
import { z } from 'zod';
import { CurrentUser, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { UsersService } from './users.service.js';

class ListQueryDto extends createZodDto(listQuerySchema) {}
class CreateUserDto extends createZodDto(createUserSchema) {}
class UpdateUserDto extends createZodDto(updateUserSchema) {}
class AssignableQueryDto extends createZodDto(z.object({ permission: z.enum(['inquiries.update', 'applications.update']).default('inquiries.update') })) {}

@ApiTags('Users')
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiZodQuery(ListQueryDto)
  list(@Query() query: ListQueryDto) {
    return this.users.list(query);
  }

  @Get('assignable')
  @RequirePermissions(PERMISSIONS.INQUIRIES_READ)
  @ApiOperation({ summary: 'Active users who can be assigned leads' })
  assignable(@Query() query: AssignableQueryDto) {
    return this.users.assignable(query.permission);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiZodBody(CreateUserDto)
  @ApiOperation({ summary: 'Invite a user. Returns a single-use invitation link (also emailed when SMTP is configured).' })
  create(@Body() body: CreateUserDto, @CurrentUser() actor: Principal, @Req() req: AppRequest) {
    return this.users.create(body, actor, requestMeta(req));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiZodBody(UpdateUserDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUserDto, @CurrentUser() actor: Principal, @Req() req: AppRequest) {
    return this.users.update(id, body, actor, requestMeta(req));
  }

  @Post(':id/access-link')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Re-send an invitation or a password reset link' })
  sendAccessLink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal, @Req() req: AppRequest) {
    return this.users.sendAccessLink(id, actor, requestMeta(req));
  }

  @Post(':id/unlock')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Clear a temporary login lockout' })
  unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Principal, @Req() req: AppRequest) {
    return this.users.unlock(id, actor, requestMeta(req));
  }
}
