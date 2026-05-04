'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Order {
    id: string;
    estado: string;
    total: number;
    userId: string;
    repartidorId?: string;
    createdAt: string;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await apiFetch('/orders/active?limit=50');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data.data || []);
                }
            } catch {
                toast.error('Error al cargar pedidos activos');
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();

        // Auto-refresh every 30s
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="max-w-6xl mx-auto w-full">
            <PageHeader title="Pedidos Activos" description="Monitoreo en tiempo real de todos los pedidos en curso en el campus." />

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
            ) : (
                <div className="w-full bg-card border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-6 py-4">ID Pedido</th>
                                    <th className="px-6 py-4">Hora</th>
                                    <th className="px-6 py-4">Cliente (ID)</th>
                                    <th className="px-6 py-4">Repartidor (ID)</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4 text-right">Estado Actual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.map(o => (
                                    <tr key={o.id} className="hover:bg-muted/30">
                                        <td className="px-6 py-4 font-medium font-mono">{o.id.slice(0, 8)}</td>
                                        <td className="px-6 py-4">
                                            {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground" title={o.userId}>{o.userId.slice(0, 8)}</td>
                                        <td className="px-6 py-4 text-muted-foreground" title={o.repartidorId || 'N/A'}>
                                            {o.repartidorId ? o.repartidorId.slice(0, 8) : '--'}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">${o.total.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Badge variant={o.estado === 'pendiente' ? 'destructive' : o.estado === 'entregado' ? 'default' : 'secondary'}>
                                                {o.estado.toUpperCase().replace('_', ' ')}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            No hay pedidos activos en este momento.
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
