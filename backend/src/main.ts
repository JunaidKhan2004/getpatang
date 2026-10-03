import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { globalValidationPipe } from './common/validation.js';
import { PUBLIC_UPLOADS_ROUTE, StorageService } from './modules/storage/storage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  const config = app.get(ConfigService);
  const isProd = config.get('NODE_ENV') === 'production';

  app.use(helmet());
  app.set('trust proxy', 1); // correct client IPs behind one reverse proxy / load balancer
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').map((o) => o.trim()),
    credentials: true,
  });
  // Public images (product photos, logos). Private documents are only served through /api/v1/uploads/:id/file.
  app.useStaticAssets(app.get(StorageService).publicDir, {
    prefix: `${PUBLIC_UPLOADS_ROUTE}/`,
    maxAge: '30d',
    immutable: true,
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(globalValidationPipe);
  app.enableShutdownHooks();

  if (!isProd) {
    const doc = new DocumentBuilder()
      .setTitle('Kite Platform API')
      .setDescription('Marketplace, tournaments and community API. All responses use { data } / { error } envelopes.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(`API ready on http://localhost:${port}/api/v1${isProd ? '' : ` · docs at /api/docs`}`, 'Bootstrap');
}

await bootstrap();
