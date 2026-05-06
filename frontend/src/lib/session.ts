export function setAccessToken(token: string) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', token);
    }
}

export function getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('accessToken');
    }
    return null;
}

export function removeAccessToken() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
    }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
                .join('')
        );
        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function getUserIdFromToken(token: string | null): string | null {
    if (!token || typeof window === 'undefined') return null;
    const payload = decodeJwtPayload(token);
    const sub = payload?.sub;
    if (typeof sub === 'string') return sub;
    const userId = payload?.userId;
    if (typeof userId === 'string') return userId;
    const id = payload?.id;
    if (typeof id === 'string') return id;
    return null;
}

export function getUserRoleFromToken(token: string | null): string | null {
    if (!token || typeof window === 'undefined') return null;
    const payload = decodeJwtPayload(token);
    const role = payload?.role;
    return typeof role === 'string' ? role : null;
}

export function setUserRoleCookie(role: string) {
    if (typeof window !== 'undefined') {
        document.cookie = `user_role=${role}; path=/; max-age=604800; samesite=lax`;
    }
}

export function getUserRoleCookie(): string | null {
    if (typeof window !== 'undefined') {
        const match = document.cookie.match(new RegExp('(^| )user_role=([^;]+)'));
        if (match) return match[2];
    }
    return null;
}

export function removeUserRoleCookie() {
    if (typeof window !== 'undefined') {
        document.cookie = `user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
}
