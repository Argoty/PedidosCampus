import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    // Rutas públicas que el Gateway dejará pasar sin requerir JWT
    private readonly publicRoutes = [
        '/auth/login',
        '/auth/register',
        '/auth/refresh'
    ];

    use(req: Request, res: Response, next: NextFunction) {
        if (req.method === 'OPTIONS') {
            return next();
        }

        // Permitir endpoints de monitoreo/health en cualquier microservicio
        if (req.originalUrl.includes('/health')) {
            return next();
        }

        // El catálogo de restaurantes y productos es público (SOLO usando método GET)
        if (req.originalUrl.startsWith('/restaurants') && req.method === 'GET') {
            return next();
        }

        // Dejar pasar si es ruta pública de JWT
        if (this.publicRoutes.some(route => req.originalUrl.startsWith(route))) {
            return next();
        }

        // Extraer token para el resto de rutas (ej: Orders, Users, POST de restaurants)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token no provisto o con formato incorrecto');
        }

        const token = authHeader.split(' ')[1];

        try {
            const secret = process.env.JWT_SECRET || 'supersecretjwt';
            const decoded = jwt.verify(token, secret);

            req['user'] = decoded;
            next();
        } catch (error) {
            throw new UnauthorizedException('Token de acceso inválido o expirado');
        }
    }
}
