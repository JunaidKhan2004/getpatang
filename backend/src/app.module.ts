import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthGuard } from './common/auth/auth.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor.js';
import { validateEnv } from './config/env.validation.js';
import { AuditModule } from './modules/audit/audit.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CommunityModule } from './modules/community/community.controllers.js';
import { CustomOrdersModule } from './modules/custom-orders/custom-orders.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { EventsModule } from './modules/events/events.js';
import { NotificationsModule } from './modules/notifications/notifications.js';
import { PaymentReviewModule } from './modules/payments/payment-review.js';
import { HealthController } from './modules/health/health.controller.js';
import { OrdersModule } from './modules/orders/orders.js';
import { PaymentsModule } from './modules/payments/payment-providers.js';
import { SellerModule } from './modules/seller/seller.module.js';
import { SettingsModule } from './modules/settings/settings.service.js';
import { ShoppingModule } from './modules/shopping/shopping.module.js';
import { StorageModule } from './modules/storage/uploads.js';
import { TournamentsModule } from './modules/tournaments/tournaments.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // Only for automated tests that sweep every route; refused in production by env validation.
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.getOrThrow('JWT_ACCESS_TTL'), issuer: 'kite-platform' },
        verifyOptions: { issuer: 'kite-platform' },
      }),
    }),
    PrismaModule,
    AuditModule,
    SettingsModule,
    StorageModule,
    NotificationsModule,
    PaymentsModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    ShoppingModule,
    OrdersModule,
    SellerModule,
    TournamentsModule,
    CommunityModule,
    PaymentReviewModule,
    AdminModule,
    EventsModule,
    CustomOrdersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit first, then authentication/authorization.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
