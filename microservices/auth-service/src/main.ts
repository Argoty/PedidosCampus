import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Necesario para leer cookie HttpOnly del refresh token en guards/estrategias.
  app.use(cookieParser());

  app.use((req: any, res: any, next: any) => {
    if (req.method !== 'OPTIONS' && req.headers['x-service-token'] !== process.env.SERVICE_TOKEN) {
      return res.status(403).json({ statusCode: 403, message: 'Forbidden' });
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: corsOrigins,
    // Permite que el navegador envie cookies entre frontend y auth-service.
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
