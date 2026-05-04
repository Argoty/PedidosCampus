import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AuthMiddleware } from './auth.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Ejecutar el AuthMiddleware para validar el JWT antes de enrutar
    consumer.apply(AuthMiddleware).forRoutes('*');

    // Token secreto interno
    const serviceTokenEnv =
      process.env.SERVICE_TOKEN || 'internal_super_secret_token_123';

    // Función auxiliar para registrar proxies limpios
    const applyProxy = (path: string, targetUrl: string) => {
      if (!targetUrl) return;
      consumer
        .apply(
          createProxyMiddleware({
            target: targetUrl,
            changeOrigin: true,
            onProxyReq: (proxyReq, req: any, res) => {
              // Inyectar secret en la petición que va a la red interna docker
              proxyReq.setHeader('x-service-token', serviceTokenEnv);

              // Inyectar userId del JWT decodificado para servicios que lo necesiten
              // El middleware ya validó el JWT y guardó el resultado en req['user']
              if (req['user'] && req['user'].sub) {
                proxyReq.setHeader('x-user-id', req['user'].sub);
              }

              // FIX para http-proxy-middleware vs NestJS body-parser
              // NestJS consume el request body antes de que llegue al proxy.
              // Si hay un body, debemos recodificarlo y re-inyectarlo en el stream del proxy.
              if (req.body && Object.keys(req.body).length > 0) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader(
                  'Content-Length',
                  Buffer.byteLength(bodyData),
                );
                proxyReq.write(bodyData);
              }
            },
          }),
        )
        .forRoutes(path);
    };

    // 2. Enrutamiento HTTP Proxy a microservicios reales según sus rutas establecidas
    applyProxy(
      '/auth',
      process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    );
    applyProxy(
      '/api/profiles',
      process.env.USER_SERVICE_URL || 'http://user-service:5000',
    );
    applyProxy(
      '/restaurants',
      process.env.RESTAURANT_SERVICE_URL || 'http://restaurant-service:8001/api/v1',
    );
    applyProxy(
      '/orders',
      process.env.ORDER_SERVICE_URL || 'http://order-service:8002',
    );
    applyProxy(
      '/notifications',
      process.env.NOTIFICACIONES_SERVICE_URL ||
        'http://notificaciones-worker.local',
    );
    applyProxy('/ratings', process.env.CALIFICACIONES_SERVICE_URL || '');
  }
}
