'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Notification {
    id: string;
    mensaje: string;
    tipo: string;
    createdAt: string;
    leida: boolean;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todas' | 'no_leidas' | 'leidas'>('todas');

    const fetchNotifs = async () => {
        try {
            const res = await apiFetch('/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifs();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            const res = await apiFetch(`/notifications/${id}/leer`, { method: 'PATCH' });
            if (res.ok) {
                toast.success('Notificación marcada como.leída');
                fetchNotifs();
            }
        } catch {
            toast.error('Error al marcar');
        }
    };

    const filtered = notifications.filter(n => {
        if (filter === 'no_leidas') return !n.leida;
        if (filter === 'leidas') return n.leida;
        return true;
    });

    const formatDate = (ts: string) => {
        try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return 'Fecha inválida';
            return d.toLocaleString('es-CO', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return 'Fecha inválida';
        }
    };

    return (
        <div className="max-w-3xl mx-auto w-full">
            <PageHeader title="Notificaciones" description="Mantente al tanto de tus pedidos y la plataforma." />

            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
                <TabsList>
                    <TabsTrigger value="todas">Todas</TabsTrigger>
                    <TabsTrigger value="no_leidas">No leídas</TabsTrigger>
                    <TabsTrigger value="leidas">Leídas</TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center border-dashed border rounded-xl bg-muted/10">
                    No hay notificaciones.
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(notif => (
                        <Card key={notif.id} className={notif.leida ? 'opacity-70' : 'border-primary border-l-4'}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{notif.mensaje}</p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {formatDate(notif.createdAt)}
                                        </p>
                                    </div>
                                    {!notif.leida && (
                                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id)}>
                                            Marcar.leída
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}