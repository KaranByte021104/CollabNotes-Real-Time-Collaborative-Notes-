import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Create uploads/avatars directory synchronously
  const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }

  // Serve static assets
  app.useStaticAssets(path.join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // Set the global API prefix
  app.setGlobalPrefix('api');

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow any origin during development (e.g. localhost, 127.0.0.1, or local network IPs)
      callback(null, true);
    },
    credentials: true,
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
}
bootstrap();
