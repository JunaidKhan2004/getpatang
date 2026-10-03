import { Module } from '@nestjs/common';

import { CategoriesController, CategoriesService } from './categories.js';
import { ProductsController, ProductsService } from './products.js';
import { SearchController, SearchService } from './search.js';
import { ShopsController, ShopsService } from './shops.js';

@Module({
  controllers: [CategoriesController, ProductsController, ShopsController, SearchController],
  providers: [CategoriesService, ProductsService, ShopsService, SearchService],
  exports: [ProductsService],
})
export class CatalogModule {}
