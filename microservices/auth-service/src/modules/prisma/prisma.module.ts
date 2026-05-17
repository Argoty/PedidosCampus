import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
// Global para evitar importar PrismaModule en cada feature module.
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
