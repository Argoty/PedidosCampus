import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Habilita process.env en toda la app sin inyectar ConfigModule por modulo.
      isGlobal: true,
    }),
    AuthModule,
  ],
})
export class AppModule {}
