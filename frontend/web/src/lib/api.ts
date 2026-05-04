import { getAccessToken, setAccessToken, removeAccessToken, removeUserRoleCookie } from './session';

let isRefreshing = false;
let refreshSubscribers: ((accessToken: string) => void)[] = [];

function onRefreshed(accessToken: string) {
    refreshSubscribers.forEach((callback) => callback(accessToken));
    refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (accessToken: string) => void) {
    refreshSubscribers.push(callback);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}${endpoint}`;
    const token = getAccessToken();

    const headers = new Headers(options.headers);
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    options.headers = headers;

    // Only include credentials (cookies) for auth endpoints to prevent CORS wildcard conflicts with other microservices
    if (endpoint.startsWith('/auth/')) {
        options.credentials = 'include';
    }

    let response = await fetch(url, options);

    // Auto Refresh Token Interceptor
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        return handle401(url, options);
    }

    return response;
}

async function handle401(originalUrl: string, originalOptions: RequestInit): Promise<Response> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    if (!isRefreshing) {
        isRefreshing = true;
        try {
            const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // Sent HttpOnly refresh token
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                setAccessToken(data.accessToken); // Update the local storage access token
                isRefreshing = false;
                onRefreshed(data.accessToken);
            } else {
                throw new Error('Refresh failed');
            }
        } catch (error) {
            isRefreshing = false;
            removeAccessToken();
            removeUserRoleCookie();
            refreshSubscribers = [];
            if (typeof window !== 'undefined') {
                window.location.href = '/login'; // Force login
            }
            return Promise.reject(error);
        }
    }

    return new Promise<Response>((resolve) => {
        addRefreshSubscriber((newAccessToken: string) => {
            const headers = new Headers(originalOptions.headers);
            headers.set('Authorization', `Bearer ${newAccessToken}`);
            originalOptions.headers = headers;
            resolve(fetch(originalUrl, originalOptions));
        });
    });
}
