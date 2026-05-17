import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS centralizado para todo el clúster
  const corsRaw = process.env.CORS_ORIGINS;
  let corsOrigin: string | string[] | boolean;
  if (!corsRaw) {
    corsOrigin = false;
  } else if (corsRaw.trim() === '*') {
    corsOrigin = '*'; // string wildcard (cors package lo maneja como "todos")
  } else {
    corsOrigin = corsRaw.split(',').map(o => o.trim());
  }
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Gateway corriendo en el puerto ${port}`);
}
bootstrap();
