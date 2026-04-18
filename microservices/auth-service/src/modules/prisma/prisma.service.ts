import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Abre conexion al iniciar el modulo Nest.
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    // Cierra conexion para shutdown limpio del proceso.
    await this.$disconnect();
  }
}
