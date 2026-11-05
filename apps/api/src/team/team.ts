import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, teamMemberInputSchema } from '@asva/shared';
import { AuditService } from '../audit/audit.service.js';
import { createCrudController, CrudService, type CrudOptions } from '../common/crud.js';
import { Public } from '../common/decorators.js';
import { MEDIA_SELECT, MediaUrlService } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

@Injectable()
export class TeamService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'teamMember',
    entity: 'team_member',
    label: 'Team member',
    tags: ['team'],
    searchFields: ['name', 'role'],
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: { photo: { select: MEDIA_SELECT } },
  };

  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, private readonly mediaUrl: MediaUrlService) {
    super(prisma, audit, revalidation);
  }

  protected override toDto(row: { photo: Parameters<MediaUrlService['dto']>[0] } & Record<string, unknown>) {
    return { ...row, photo: this.mediaUrl.dto(row.photo) };
  }

  async listPublic() {
    const rows = await this.prisma.teamMember.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, role: true, bio: true, linkedinUrl: true, photo: { select: MEDIA_SELECT } },
    });
    return rows.map((r) => ({ ...r, photo: this.mediaUrl.dto(r.photo) }));
  }
}

@ApiTags('Team')
@Controller('team')
export class TeamPublicController {
  constructor(private readonly team: TeamService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Visible team members for the About page' })
  list() {
    return this.team.listPublic();
  }
}

@Module({
  providers: [TeamService],
  controllers: [
    TeamPublicController,
    createCrudController({ path: 'team', tag: 'Team', permission: PERMISSIONS.TEAM_MANAGE, inputSchema: teamMemberInputSchema, service: TeamService }),
  ],
})
export class TeamModule {}
