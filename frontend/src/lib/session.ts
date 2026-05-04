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
