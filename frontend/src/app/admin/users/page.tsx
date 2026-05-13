'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface UserProfile {
    id: string;
    tipo: string;
    nombre: string;
    telefono: string;
    isActive: boolean;
    disponible: boolean;
    createdAt: string;
}

interface UserProfileApi extends UserProfile {
    is_active?: boolean;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const res = await apiFetch('/api/profiles?limit=50');
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data) ? data : (data.data || data.items || []);
                setUsers((items as UserProfileApi[]).map((u) => ({
                    ...u,
                    isActive: u.isActive ?? u.is_active ?? false
                })));
            }
        } catch {
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleActive = async (profileId: string, current: boolean) => {
        try {
            const action = current ? 'deactivate' : 'activate';
            const res = await apiFetch(`/api/profiles/${profileId}/${action}`, { method: 'POST' });
            if (res.ok) {
                toast.success(`Usuario ${current ? 'desactivado' : 'activado'}`);
                fetchUsers();
            } else {
                throw new Error();
            }
        } catch {
            toast.error('Error al cambiar estado del usuario');
        }
    };

    return (
        <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <PageHeader title="Gestión de Usuarios" description="Administra estudiantes y repartidores del sistema." />
                <Button onClick={() => window.location.href = '/admin/ai-agent'} variant="outline">
                    Consultar Agente IA
                </Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : (
                <div className="w-full bg-card border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-6 py-4">Nombre</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-muted/30">
                                        <td className="px-6 py-4 font-medium">{u.nombre || 'Sin nombre'}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline">{u.tipo}</Badge>
                                            {u.tipo === 'repartidor' && (
                                                <span className={`ml-2 text-xs ${u.disponible ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {u.disponible ? '(En línea)' : '(Offline)'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={u.isActive ? "default" : "destructive"}>
                                                {u.isActive ? "Activo" : "Suspendido"}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant={u.isActive ? "destructive" : "default"}
                                                size="sm"
                                                onClick={() => toggleActive(u.id, u.isActive)}
                                            >
                                                {u.isActive ? 'Suspender' : 'Activar'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                            No se encontraron usuarios.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
