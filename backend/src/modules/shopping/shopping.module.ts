import { Module } from '@nestjs/common';

import { CartService } from './cart.service.js';
import {
  AddressesController,
  AddressesService,
  CartController,
  WishlistController,
  WishlistService,
} from './shopping.controllers.js';

@Module({
  controllers: [CartController, WishlistController, AddressesController],
  providers: [CartService, WishlistService, AddressesService],
  exports: [CartService, AddressesService],
})
export class ShoppingModule {}
