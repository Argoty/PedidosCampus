import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS centralizado para todo el clúster
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : true;
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Gateway corriendo en el puerto ${port}`);
}
bootstrap();
