'use client';
import { useEffect, useState, use } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface OrderItem {
    id: string;
    productId: string;
    nombre: string;
    precioUnit: number;
    cantidad: number;
    subtotal: number;
}

interface OrderDetail {
    id: string;
    estado: string;
    total: number;
    subtotal: number;
    costoEntrega: number;
    direccionEntrega: string;
    createdAt: string;
    items: OrderItem[];
    restauranteId: string;
    repartidorId?: string;
    historial?: OrderHistory[];
}

interface OrderHistory {
    id: string;
    fromEstado?: string | null;
    toEstado: string;
    changedBy?: string | null;
    createdAt: string;
}

interface RepartidorProfile {
    id: string;
    nombre: string;
    telefono?: string | null;
}

interface Rating {
    id: string;
    estrellas: number;
    comentario: string | null;
    pedido_id: string;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const [ratingRestaurante, setRatingRestaurante] = useState(0);
    const [comentarioRestaurante, setComentarioRestaurante] = useState('');
    const [ratingRepartidor, setRatingRepartidor] = useState(0);
    const [comentarioRepartidor, setComentarioRepartidor] = useState('');
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const [existingRestauranteRating, setExistingRestauranteRating] = useState<Rating | null>(null);
    const [existingRepartidorRating, setExistingRepartidorRating] = useState<Rating | null>(null);
    const [repartidorProfile, setRepartidorProfile] = useState<RepartidorProfile | null>(null);
    const [historial, setHistorial] = useState<OrderHistory[]>([]);

    useEffect(() => {
        const fetchOrder = async () => {
            const res = await apiFetch(`/orders/${unwrappedParams.id}`);
            if (!res.ok) return null;
            return res.json();
        };

        const fetchRepartidor = async (repartidorId: string) => {
            try {
                const repRes = await apiFetch(`/api/profiles/user/${repartidorId}`);
                if (repRes.ok) {
                    const repData = await repRes.json();
                    setRepartidorProfile(repData);
                    return;
                }
            } catch {
                // ignore
            }
            setRepartidorProfile(null);
        };

        const fetchRatings = async (userId: string, orderId: string) => {
            try {
                const [rRes, dRes] = await Promise.all([
                    apiFetch(`/ratings/restaurant/user/${userId}?limit=50&offset=0`),
                    apiFetch(`/ratings/delivery/user/${userId}?limit=50&offset=0`)
                ]);

                if (rRes.ok) {
                    const rData = await rRes.json();
                    const match = (rData.data || []).find((r: Rating) => r.pedido_id === orderId);
                    setExistingRestauranteRating(match || null);
                }

                if (dRes.ok) {
                    const dData = await dRes.json();
                    const match = (dData.data || []).find((r: Rating) => r.pedido_id === orderId);
                    setExistingRepartidorRating(match || null);
                }
            } catch {
                setExistingRestauranteRating(null);
                setExistingRepartidorRating(null);
            }
        };

        const init = async () => {
            try {
                const data = await fetchOrder();
                if (!data) {
                    toast.error('No se pudo cargar el pedido');
                    return;
                }

                setOrder(data);
                const history = (data.historial || []) as OrderHistory[];
                setHistorial(history.filter((h) => h.toEstado !== 'pendiente'));

                if (data?.repartidorId) {
                    await fetchRepartidor(data.repartidorId);
                } else {
                    setRepartidorProfile(null);
                }

                if (user?.id) {
                    await fetchRatings(user.id, data.id);
                }
            } catch {
                toast.error('Error de conexión');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [unwrappedParams.id, user?.id]);

    const submitRatingRestaurante = async () => {
        if (order?.estado !== 'entregado') {
            toast.error('Solo puedes calificar cuando el pedido este entregado');
            return;
        }
        if (!order?.restauranteId || !ratingRestaurante) return;
        try {
            const res = await apiFetch('/ratings/restaurant', {
                method: 'POST',
                body: JSON.stringify({
                    pedido_id: order.id,
                    restaurante_id: order.restauranteId,
                    estrellas: ratingRestaurante,
                    comentario: comentarioRestaurante || null
                })
            });
            if (res.ok) {
                const data = await res.json();
                setExistingRestauranteRating(data);
                toast.success('¡Gracias por calificar el restaurante!');
            } else {
                const d = await res.json();
                toast.error(d.message || 'No se pudo enviar');
            }
        } catch { toast.error('Error de red'); }
    };

    const submitRatingRepartidor = async () => {
        if (order?.estado !== 'entregado') {
            toast.error('Solo puedes calificar cuando el pedido este entregado');
            return;
        }
        if (!order?.repartidorId || !ratingRepartidor) return;
        try {
            const res = await apiFetch('/ratings/delivery', {
                method: 'POST',
                body: JSON.stringify({
                    pedido_id: order.id,
                    repartidor_id: order.repartidorId,
                    estrellas: ratingRepartidor,
                    comentario: comentarioRepartidor || null
                })
            });
            if (res.ok) {
                const data = await res.json();
                setExistingRepartidorRating(data);
                toast.success('¡Gracias por calificar al repartidor!');
            } else {
                const d = await res.json();
                toast.error(d.message || 'No se pudo enviar');
            }
        } catch { toast.error('Error de red'); }
    };

    const cancelOrder = async () => {
        try {
            const res = await apiFetch(`/orders/${unwrappedParams.id}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Cancelado por usuario' })
            });
            if (res.ok) {
                toast.success('Pedido cancelado');
                setOrder(prev => prev ? { ...prev, estado: 'cancelado' } : null);
            } else { toast.error('No se puede cancelar'); }
        } catch { toast.error('Error de red'); }
        setShowCancelConfirm(false);
    };

    if (loading) return <div className="space-y-4 max-w-4xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
    if (!order) return <div className="text-center py-12">Pedido no encontrado</div>;

    return (
        <div className="max-w-4xl mx-auto w-full">
            <PageHeader 
                title={`Pedido del ${order?.createdAt ? new Date(order.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`} 
                description={`Hora: ${order?.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}`}
            >
                <Badge className="text-sm px-4 py-1.5" variant={order.estado === 'entregado' ? 'default' : 'secondary'}>
                    {order.estado.toUpperCase()}
                </Badge>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Productos</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {order.items.map(item => (
                                <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                    <div>
                                        <p className="font-medium">{item.nombre}</p>
                                        <p className="text-sm text-muted-foreground">{item.cantidad} x ${item.precioUnit.toFixed(2)}</p>
                                    </div>
                                    <span className="font-bold">${item.subtotal.toFixed(2)}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {order.estado === 'entregado' && user?.role === 'usuario' && (
                        <div className="space-y-6">
                            {existingRestauranteRating ? (
                                <Card>
                                    <CardHeader><CardTitle>Tu Calificación</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex gap-1 mb-2">
                                            {[1,2,3,4,5].map(s => (
                                                <span key={s} className={`text-xl ${s <= existingRestauranteRating.estrellas ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                                            ))}
                                        </div>
                                        {existingRestauranteRating.comentario && <p className="text-sm text-muted-foreground">{existingRestauranteRating.comentario}</p>}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                <CardHeader>
                                    <CardTitle>Calificar Restaurante</CardTitle>
                                    <CardDescription>Comparte tu opinión</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        {[1,2,3,4,5].map(s => (
                                            <button key={s} onClick={() => setRatingRestaurante(s)} className={`text-2xl ${ratingRestaurante >= s ? 'text-yellow-500' : 'text-gray-300'}`}>★</button>
                                        ))}
                                    </div>
                                    <Input placeholder="Comentario..." value={comentarioRestaurante} onChange={e => setComentarioRestaurante(e.target.value)} />
                                    <Button onClick={submitRatingRestaurante} disabled={!ratingRestaurante || order.estado !== 'entregado'}>Enviar</Button>
                                </CardContent>
                            </Card>
                            )}

                            {order.repartidorId && (existingRepartidorRating ? (
                                <Card>
                                    <CardHeader><CardTitle>Tu Calificación al Repartidor</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex gap-1 mb-2">
                                            {[1,2,3,4,5].map(s => (
                                                <span key={s} className={`text-xl ${s <= existingRepartidorRating.estrellas ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                                            ))}
                                        </div>
                                        {existingRepartidorRating.comentario && <p className="text-sm text-muted-foreground">{existingRepartidorRating.comentario}</p>}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                <CardHeader><CardTitle>Calificar Repartidor</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        {[1,2,3,4,5].map(s => (
                                            <button key={s} onClick={() => setRatingRepartidor(s)} className={`text-2xl ${ratingRepartidor >= s ? 'text-yellow-500' : 'text-gray-300'}`}>★</button>
                                        ))}
                                    </div>
                                    <Input placeholder="Comentario..." value={comentarioRepartidor} onChange={e => setComentarioRepartidor(e.target.value)} />
                                    <Button onClick={submitRatingRepartidor} disabled={!ratingRepartidor || order.estado !== 'entregado'}>Enviar</Button>
                                </CardContent>
                            </Card>
                            ))}
                        </div>
                    )}
                </div>

                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Entrega</span><span>${order.costoEntrega.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold pt-2 border-t"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Entrega</CardTitle></CardHeader>
                        <CardContent><p className="text-sm">{order.direccionEntrega}</p></CardContent>
                    </Card>

                    {historial.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                {historial.map((h) => (
                                    <div key={h.id} className="flex items-center justify-between text-sm">
                                        <div className="font-medium capitalize">{h.toEstado.replace('_', ' ')}</div>
                                        <div className="text-muted-foreground">
                                            {new Date(h.createdAt).toLocaleString('es-CO', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {order.repartidorId && (
                        <Card>
                            <CardHeader><CardTitle>Repartidor</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm font-medium">
                                    {repartidorProfile?.nombre || 'Repartidor asignado'}
                                </p>
                                {repartidorProfile?.telefono && (
                                    <p className="text-sm text-muted-foreground">Tel: {repartidorProfile.telefono}</p>
                                )}
                                {!repartidorProfile && (
                                    <p className="text-xs text-muted-foreground">ID: {order.repartidorId.slice(0, 8)}</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {order.estado === 'pendiente' && user?.role === 'usuario' && (
                        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full">Cancelar Pedido</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>No</AlertDialogCancel>
                                    <AlertDialogAction onClick={cancelOrder} className="bg-destructive text-white">Sí, cancelar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        </div>
    );
}
