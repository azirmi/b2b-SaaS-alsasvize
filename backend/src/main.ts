import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parse cookies so the JWT can be read from an HTTP-only cookie.
  app.use(cookieParser());

  // Allow the browser app to call the API with credentials (the HTTP-only auth
  // cookie). Origins come from CORS_ORIGIN (comma-separated) in production; local
  // dev falls back to the Next.js app on :3000.
  const corsOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      corsOrigins && corsOrigins.length > 0
        ? corsOrigins
        : 'http://localhost:3000',
    credentials: true,
  });

  // Validate and strip unknown properties from incoming DTOs at the boundary.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Ensure Nest lifecycle hooks (e.g. Prisma $disconnect) run on SIGTERM/SIGINT.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
