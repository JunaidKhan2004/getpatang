import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus, ParticipantStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const TOURNAMENT_VIEWS = ['upcoming', 'open', 'live', 'completed'] as const;

export class TournamentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TOURNAMENT_VIEWS, description: 'upcoming = published and not started; open = registration open now' })
  @IsOptional()
  @IsIn(TOURNAMENT_VIEWS)
  view?: (typeof TOURNAMENT_VIEWS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ example: '2027' })
  @IsOptional()
  @Matches(/^\d{4}$/)
  season?: string;
}

export class TournamentInputDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 100, { message: 'Name must be 5–100 characters' })
  name: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(30, 5000, { message: 'Describe the tournament in 30–5000 characters' })
  description: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  venue: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  venueAddress?: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Choose a start date and time' })
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Choose when registration opens' })
  registrationOpensAt: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Choose when registration closes' })
  registrationClosesAt: string;

  @ApiProperty({ minimum: 2, maximum: 256 })
  @Type(() => Number)
  @IsInt()
  @Min(2, { message: 'At least 2 players' })
  @Max(256, { message: 'At most 256 players' })
  maxParticipants: number;

  @ApiProperty({ minimum: 8, maximum: 99 })
  @Type(() => Number)
  @IsInt()
  @Min(8)
  @Max(99)
  minAge: number;

  @ApiProperty({ description: 'Rupees; 0 for free entry' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  entryFee: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  prizeInfo?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(20, 10000, { message: 'Write the competition rules (at least 20 characters)' })
  rules: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(20, 5000, { message: 'Safety rules are required (at least 20 characters)' })
  safetyRules: string;

  @ApiProperty({ example: 'Paper kites and plain cotton string only. No metal, glass-coated or chemical string.' })
  @Transform(trim)
  @IsString()
  @Length(10, 2000, { message: 'List the approved materials' })
  approvedMaterials: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  venueRestrictions?: string;

  @ApiPropertyOptional({ description: 'Permission reference from the local authority; required to publish' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  permitReference?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  organizerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  organizerContact?: string;

  @ApiProperty({ example: '2027' })
  @Matches(/^\d{4}$/, { message: 'Season is a year, e.g. 2027' })
  season: string;

  @ApiPropertyOptional({ description: 'Upload id (tournament_banner), or null to remove' })
  @IsOptional()
  @IsString()
  bannerUploadId?: string | null;
}

export class RegisterDto {
  @ApiProperty({ description: 'Must be true: the player accepts the rules, safety rules and approved materials' })
  @Equals(true, { message: 'Accept the rules and safety requirements to register' })
  acceptRules: boolean;

  @ApiPropertyOptional({ description: 'Required when the profile has no date of birth (used for the age limit)' })
  @IsOptional()
  @IsDateString({}, { message: 'Enter your date of birth' })
  dateOfBirth?: string;
}

export class UpdateParticipantDto {
  @ApiPropertyOptional({ enum: ['CONFIRMED', 'WAITLISTED', 'REJECTED', 'DISQUALIFIED'] })
  @IsOptional()
  @IsIn([ParticipantStatus.CONFIRMED, ParticipantStatus.WAITLISTED, ParticipantStatus.REJECTED, ParticipantStatus.DISQUALIFIED])
  status?: ParticipantStatus;

  @ApiPropertyOptional({ description: '1 = top seed; null to clear' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(256)
  seed?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CancelTournamentDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'Tell participants why it is cancelled' })
  reason: string;
}

export class ScheduleMatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  location?: string | null;

  @ApiPropertyOptional({ description: 'User id of a match official, or null to unassign' })
  @IsOptional()
  @IsString()
  officialId?: string | null;
}

export class MatchStatusDto {
  @ApiProperty({ enum: [MatchStatus.CHECK_IN, MatchStatus.LIVE] })
  @IsIn([MatchStatus.CHECK_IN, MatchStatus.LIVE])
  status: MatchStatus;
}

export class MatchResultDto {
  @ApiProperty({ description: 'Participant id of the winner (player A or B)' })
  @IsString()
  winnerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  scoreA?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  scoreB?: number;

  @ApiPropertyOptional({ description: 'The other player did not show up or withdrew' })
  @IsOptional()
  @IsBoolean()
  walkover?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Upload id (match_evidence)' })
  @IsOptional()
  @IsString()
  evidenceUploadId?: string;
}

export class DisputeDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(10, 1000, { message: 'Explain what went wrong (at least 10 characters)' })
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['uphold', 'overturn'] })
  @IsIn(['uphold', 'overturn'])
  decision: 'uphold' | 'overturn';

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'Explain the decision' })
  note: string;
}

export class RankingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2027' })
  @IsOptional()
  @Matches(/^\d{4}$/)
  season?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ description: 'Tournament slug' })
  @IsOptional()
  @IsString()
  tournament?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class OfficialMatchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsIn(Object.values(MatchStatus))
  status?: MatchStatus;

  @ApiPropertyOptional({ description: 'Managers: show all matches, not only mine' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  all?: boolean;
}
