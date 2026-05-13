'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAccessToken, setAccessToken, removeAccessToken, setUserRoleCookie, removeUserRoleCookie, getUserRoleCookie, getUserIdFromToken, getUserRoleFromToken } from '../lib/session';
import { apiFetch } from '../lib/api';

export interface User {
    id: string;
    role: string;
    nombre?: string;
    telefono?: string;
    direccion?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (accessToken: string, role: string, userData: Partial<User>) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = getAccessToken();
            const role = getUserRoleCookie();

            if (token && role) {
                try {
                    // If the profile microservice handles both user & repartidor, fetch me and set it.
                    // Note: The prompt mentioned GET /profiles/me over Gateway
                    const res = await apiFetch('/api/profiles/me');
                    if (res.ok) {
                        const data = await res.json();
                        setUser(prev => ({
                            ...prev,
                            ...data,
                            id: prev?.id || data.userId || data.id,
                            profileId: data.id,
                            role
                        }));
                    } else {
                        // Unsuccessful profile fetch could mean 404 (needs to create profile) or 401/403.
                        // If it's a 401, the interceptor will have tried to refresh and if failed it would redirect.
                        if (res.status !== 401 && res.status !== 403) {
                            // fallback user if profile not fully created yet
                            setUser({ id: 'unknown', role });
                        }
                    }
                } catch (e) {
                    console.error('Failed to init auth context:', e);
                }
            } else if (token && !role) {
                const tokenRole = getUserRoleFromToken(token);
                if (tokenRole) {
                    setUserRoleCookie(tokenRole);
                    setUser({ id: getUserIdFromToken(token) || 'unknown', role: tokenRole });
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = (accessToken: string, role: string, userData: Partial<User>) => {
        setAccessToken(accessToken);
        setUserRoleCookie(role);
        const tokenUserId = getUserIdFromToken(accessToken);
        setUser({ ...userData, role, id: userData?.id || tokenUserId || 'unknown' } as User);
    };

    const logout = async () => {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error(e);
        }
        removeAccessToken();
        removeUserRoleCookie();
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
