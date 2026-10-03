import { Module } from '@nestjs/common';

import { AdminInsightsController, AdminInsightsService } from './admin-insights.js';
import { AdminOrdersController, AdminOrdersService } from './admin-orders.js';
import { AdminSettingsController, AdminSettingsService } from './admin-settings.js';
import { AdminUsersController, AdminUsersService } from './admin-users.js';
import { ContentPagesController, ContentPagesService } from './content-pages.js';

/** Staff tools added in Phase 8. Marketplace moderation lives in admin-marketplace.ts (SellerModule). */
@Module({
  controllers: [AdminUsersController, AdminOrdersController, AdminSettingsController, AdminInsightsController, ContentPagesController],
  providers: [AdminUsersService, AdminOrdersService, AdminSettingsService, AdminInsightsService, ContentPagesService],
})
export class AdminModule {}
