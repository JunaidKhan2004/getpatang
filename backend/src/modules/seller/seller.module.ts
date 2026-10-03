import { Module } from '@nestjs/common';

import { AdminMarketplaceController, AdminMarketplaceService } from '../admin/admin-marketplace.js';
import { ProductRules } from './product-rules.js';
import { SellerInsightsController, SellerInsightsService } from './seller-insights.js';
import { SellerOrdersController, SellerOrdersService } from './seller-orders.js';
import { SellerProductsController, SellerProductsService } from './seller-products.js';
import { SellerContext, SellerShopController, SellerShopService } from './seller-shop.js';

@Module({
  controllers: [SellerShopController, SellerProductsController, SellerOrdersController, SellerInsightsController, AdminMarketplaceController],
  providers: [
    SellerContext,
    SellerShopService,
    SellerProductsService,
    SellerOrdersService,
    SellerInsightsService,
    ProductRules,
    AdminMarketplaceService,
  ],
})
export class SellerModule {}
