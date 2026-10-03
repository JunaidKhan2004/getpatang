import { Module } from '@nestjs/common';

import { ProductRules } from '../seller/product-rules.js';
import { MatchesService } from './matches.service.js';
import { RankingsService } from './rankings.service.js';
import {
  AdminTournamentsController,
  MatchesController,
  OfficialsController,
  RankingsController,
  TournamentsController,
} from './tournaments.controllers.js';
import { TournamentsService } from './tournaments.service.js';

@Module({
  controllers: [TournamentsController, MatchesController, RankingsController, OfficialsController, AdminTournamentsController],
  providers: [TournamentsService, MatchesService, RankingsService, ProductRules],
})
export class TournamentsModule {}
