'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import Link from 'next/link';

interface Order {
    id: string;
    restauranteId: string;
    estado: string;
    total: number;
    createdAt: string;
}

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await apiFetch('/orders?limit=20');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data.data || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'pendiente': return <Badge variant="secondary" className="px-3 py-1 text-sm">Pendiente</Badge>;
            case 'aceptado': return <Badge className="bg-blue-500 px-3 py-1 text-sm">Aceptado</Badge>;
            case 'en_camino': return <Badge className="bg-yellow-500 px-3 py-1 text-sm">En Camino</Badge>;
            case 'entregado': return <Badge className="bg-green-600 px-3 py-1 text-sm">Entregado</Badge>;
            case 'cancelado': return <Badge variant="destructive" className="px-3 py-1 text-sm">Cancelado</Badge>;
            default: return <Badge className="px-3 py-1 text-sm">{estado}</Badge>;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto">
            <PageHeader title="Mis Pedidos" description="Historial de tus pedidos realizados." />

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
                </div>
            ) : orders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                    No tienes pedidos en tu historial.
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {orders.map(order => (
                        <Card key={order.id} className="flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow rounded-lg">
                            <CardHeader className="flex-1 pb-2 flex flex-row items-center justify-between border-none">
                                <div>
                                    <CardTitle className="text-lg">Pedido del {new Date(order.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {getStatusBadge(order.estado)}
                            </CardHeader>
                            <CardContent className="flex items-center md:justify-end md:w-48 py-4 md:py-6">
                                <span className="font-bold text-xl">${order.total.toFixed(2)}</span>
                            </CardContent>
                            <CardFooter className="md:w-auto items-center justify-end md:justify-center p-4 border-none">
                                <Link href={`/dashboard/orders/${order.id}`}>
                                    <Button variant="outline" className="w-full md:w-auto gap-2">
                                        <FileText className="h-4 w-4" />
                                        Ver Detalle
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
