import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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
