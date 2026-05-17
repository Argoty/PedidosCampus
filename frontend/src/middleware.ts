import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const role = request.cookies.get('user_role')?.value;
    const { pathname } = request.nextUrl;

    const loginUrl = new URL('/login', request.url);

    // Check required roles based on path prefixes
    const requiresAuth = pathname.startsWith('/dashboard') || pathname.startsWith('/repartidor') || pathname.startsWith('/admin') || pathname.startsWith('/orders');

    if (requiresAuth && !role) {
        return NextResponse.redirect(loginUrl);
    }

    // Dashboard allows any authenticated user (usuario, admin, repartidor)
    // Repartidor dashboard
    if (pathname.startsWith('/repartidor') && role !== 'repartidor' && role !== 'admin') {
        return NextResponse.redirect(loginUrl);
    }

    // Admin dashboard
    if (pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/repartidor/:path*',
        '/admin/:path*'
    ],
};
