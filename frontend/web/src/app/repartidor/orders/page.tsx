'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, ShoppingBag } from 'lucide-react';

interface Order {
    id: string;
    estado: string;
    direccionEntrega: string;
    total: number;
    repartidorId?: string;
}

export default function RepartidorOrdersPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        if (!user || !user.id) return;
        try {
            // Mis pedidos asignados
            const resAssigned = await apiFetch(`/orders/deliverer/${user.id}?limit=20`);
            if (resAssigned.ok) {
                const dataAssigned = await resAssigned.json();
                setAssignedOrders((dataAssigned.data || []).filter((o: Order) => o.estado !== 'entregado' && o.estado !== 'cancelado'));
            }

            // Pedidos disponibles para aceptar (nuevo endpoint)
            const resPending = await apiFetch('/orders/available?limit=20');
            if (resPending.ok) {
                const dataPending = await resPending.json();
                setPendingOrders(dataPending.data || []);
            }
        } catch {
            toast.error('Error al cargar pedidos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && user?.id) {
            fetchOrders();
        }
    }, [user?.id, authLoading]);

    // Don't render until auth is ready
    if (authLoading) {
        return (
            <div className="max-w-4xl mx-auto w-full">
                <PageHeader title="Repartidor" description="Cargando..." />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            </div>
        );
    }

    const acceptOrder = async (orderId: string) => {
        try {
            const res = await apiFetch(`/orders/${orderId}/accept`, {
                method: 'POST',
                body: JSON.stringify({ repartidorId: user?.id })
            });
            if (res.ok) {
                toast.success('¡Pedido aceptado! Ahora está en camino.');
                fetchOrders();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Error al aceptar');
            }
        } catch {
            toast.error('Error de conexión');
        }
    };

    const updateStatus = async (orderId: string, toEstado: string) => {
        try {
            const res = await apiFetch(`/orders/${orderId}/status`, {
                method: 'POST',
                body: JSON.stringify({ toEstado })
            });
            if (res.ok) {
                toast.success(`Pedido marcado como ${toEstado.replace('_', ' ')}`);
                fetchOrders();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Error al actualizar');
            }
        } catch {
            toast.error('Error de conexión');
        }
    };

    return (
        <div className="max-w-4xl mx-auto w-full">
            <PageHeader title="Repartidor" description="Acepta pedidos y gestiona tus entregas." />

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            ) : (
                <>
                    {pendingOrders.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5" />
                                Pedidos Disponibles para Entregar
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingOrders.map(order => (
                                    <Card key={order.id} className="flex flex-col border-yellow-500/50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-lg">#{order.id.slice(0, 8)}</CardTitle>
                                            <CardDescription className="flex items-center gap-1">
                                                <MapPin className="h-4 w-4" /> {order.direccionEntrega}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="py-2">
                                            <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
                                        </CardContent>
                                        <CardFooter className="pt-4 border-t">
                                            <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => acceptOrder(order.id)}>
                                                Aceptar Pedido
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    <h2 className="text-lg font-semibold mb-4">Tus Entregas Activas</h2>
                    {assignedOrders.length === 0 ? (
                        <div className="text-center py-12 border-dashed border rounded-xl bg-muted/10">
                            No tienes pedidos asignados actualmente en progreso.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {assignedOrders.map(order => (
                                <Card key={order.id} className="flex flex-col">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg">#{order.id.slice(0, 8)}</CardTitle>
                                            <Badge variant={order.estado === 'en_camino' ? 'default' : 'secondary'} className={order.estado === 'en_camino' ? 'bg-yellow-500' : ''}>
                                                {order.estado.toUpperCase().replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <CardDescription className="flex items-center gap-1 mt-1">
                                            <MapPin className="h-4 w-4" /> {order.direccionEntrega}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="py-2">
                                        <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
                                    </CardContent>
                                    <CardFooter className="flex gap-2 w-full mt-auto pt-4 border-t">
                                        {order.estado === 'aceptado' && (
                                            <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => updateStatus(order.id, 'en_camino')}>
                                                Marcar En Camino
                                            </Button>
                                        )}
                                        {order.estado === 'en_camino' && (
                                            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(order.id, 'entregado')}>
                                                Confirmar Entrega
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
