import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { MatchStatus, TournamentStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';

import {
  type AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  ReqMeta,
  type RequestMeta,
  RequirePermissions,
} from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { MatchesService } from './matches.service.js';
import { RankingsService } from './rankings.service.js';
import {
  CancelTournamentDto,
  DisputeDto,
  MatchResultDto,
  MatchStatusDto,
  OfficialMatchQueryDto,
  RankingQueryDto,
  RegisterDto,
  ResolveDisputeDto,
  ScheduleMatchDto,
  TournamentInputDto,
  TournamentQueryDto,
  UpdateParticipantDto,
} from './tournaments.dto.js';
import { TournamentsService } from './tournaments.service.js';

class ScheduleQueryDto {
  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsIn(Object.values(MatchStatus))
  status?: MatchStatus;
}

class AdminTournamentQueryDto extends TournamentQueryDto {
  @ApiPropertyOptional({ enum: TournamentStatus })
  @IsOptional()
  @IsIn(Object.values(TournamentStatus))
  status?: TournamentStatus;
}

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Discover tournaments (upcoming, open for registration, live, completed)' })
  list(@Query() query: TournamentQueryDto) {
    return this.tournaments.list(query);
  }

  @ApiBearerAuth()
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.tournaments.myTournaments(user.id);
  }

  @OptionalAuth()
  @Get(':slug')
  detail(@Param('slug') slug: string, @MaybeUser() user?: AuthUser) {
    return this.tournaments.detail(slug, user?.id);
  }

  @Public()
  @Get(':slug/participants')
  participants(@Param('slug') slug: string) {
    return this.tournaments.participants(slug);
  }

  @Public()
  @Get(':slug/bracket')
  bracket(@Param('slug') slug: string) {
    return this.tournaments.bracket(slug);
  }

  @Public()
  @Get(':slug/schedule')
  schedule(@Param('slug') slug: string, @Query() q: ScheduleQueryDto) {
    return this.tournaments.schedule(slug, q.status);
  }

  @ApiBearerAuth()
  @Post(':slug/registration')
  @ApiOperation({ summary: 'Register (accepting rules and safety requirements; age is checked)' })
  register(@Param('slug') slug: string, @Body() dto: RegisterDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.register(slug, user.id, dto, meta);
  }

  @ApiBearerAuth()
  @Delete(':slug/registration')
  withdraw(@Param('slug') slug: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.withdraw(slug, user.id, meta);
  }
}

@ApiTags('Tournaments')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.matches.get(id);
  }

  @ApiBearerAuth()
  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A player in the match disputes it' })
  dispute(@Param('id') id: string, @Body() dto: DisputeDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.dispute(id, user.id, dto, meta);
  }
}

@ApiTags('Rankings')
@Controller()
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Public()
  @Get('rankings')
  @ApiOperation({ summary: 'Leaderboard with season, city, tournament and date filters' })
  list(@Query() q: RankingQueryDto) {
    return this.rankings.rankings(q);
  }

  @Public()
  @Get('rankings/filters')
  filters() {
    return this.rankings.filters();
  }

  @Public()
  @Get('players/:userId')
  player(@Param('userId') userId: string) {
    return this.rankings.player(userId);
  }
}

/** Match officials: assigned matches only (managers may see all). */
@ApiTags('Officials')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.MATCHES_OFFICIATE)
@Controller('officials/matches')
export class OfficialsController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: OfficialMatchQueryDto) {
    return this.matches.officialMatches(user, q);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  status(@Param('id') id: string, @Body() dto: MatchStatusDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.setStatus(id, dto.status, user, meta);
  }

  @Post(':id/result')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MATCHES_OFFICIATE, PERMISSIONS.MATCH_RESULTS_SUBMIT)
  @ApiOperation({ summary: 'Submit the official result (assigned official or tournament manager)' })
  result(@Param('id') id: string, @Body() dto: MatchResultDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.submitResult(id, dto, user, meta);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.TOURNAMENTS_MANAGE)
@Controller('admin')
export class AdminTournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly matches: MatchesService,
  ) {}

  @Get('tournaments')
  list(@Query() q: AdminTournamentQueryDto) {
    return this.tournaments.adminList(q);
  }

  @Get('tournaments/:id')
  detail(@Param('id') id: string) {
    return this.tournaments.adminDetail(id);
  }

  @Post('tournaments')
  create(@Body() dto: TournamentInputDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.create(dto, user.id, meta);
  }

  @Put('tournaments/:id')
  update(@Param('id') id: string, @Body() dto: TournamentInputDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.update(id, dto, user.id, meta);
  }

  @Post('tournaments/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft (requires a permit reference)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.publish(id, user.id, meta);
  }

  @Post('tournaments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelTournamentDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.cancel(id, dto.reason, user.id, meta);
  }

  @Patch('tournaments/:id/participants/:participantId')
  participant(@Param('id') id: string, @Param('participantId') pid: string, @Body() dto: UpdateParticipantDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.updateParticipant(id, pid, dto, user.id, meta);
  }

  @Post('tournaments/:id/bracket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close registration and draw the bracket' })
  bracket(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.tournaments.generateBracket(id, user.id, meta);
  }

  @Patch('matches/:id')
  @ApiOperation({ summary: 'Schedule a match, set its location and assign an official' })
  schedule(@Param('id') id: string, @Body() dto: ScheduleMatchDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.schedule(id, dto, user, meta);
  }

  @Post('matches/:id/resolve-dispute')
  @HttpCode(HttpStatus.OK)
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.resolveDispute(id, dto, user, meta);
  }

  @Get('officials')
  officials() {
    return this.matches.officials();
  }

  @Post('rankings/recalculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply the current points formula (setting rankings.points) to all completed tournaments' })
  recalculate(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.matches.recalculateRankings(user.id, meta);
  }
}
