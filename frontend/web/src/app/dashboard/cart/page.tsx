'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CartItem {
    productId: string;
    nombre: string;
    precioUnit: number;
    cantidad: number;
    subtotal: number;
}

interface Cart {
    restauranteId: string;
    items: CartItem[];
}

export default function CartPage() {
    const [cart, setCart] = useState<Cart | null>(null);
    const [direccion, setDireccion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        try {
            const data = localStorage.getItem('cart');
            if (data) setCart(JSON.parse(data));

            if (user?.direccion && !direccion) {
                setDireccion(user.direccion);
            }
        } catch { }
    }, [user]);

    const updateQuantity = (productId: string, delta: number) => {
        if (!cart) return;
        const newCart = { ...cart };
        const item = newCart.items.find(i => i.productId === productId);
        if (!item) return;

        item.cantidad += delta;
        if (item.cantidad <= 0) {
            newCart.items = newCart.items.filter(i => i.productId !== productId);
        } else {
            item.subtotal = Number(item.precioUnit) * item.cantidad;
        }

        setCart(newCart);
        localStorage.setItem('cart', JSON.stringify(newCart));
    };

    const clearCart = () => {
        setCart(null);
        localStorage.removeItem('cart');
        toast.info("Carrito vaciado");
    };

    const submitOrder = async () => {
        if (!cart || cart.items.length === 0) return;
        if (!direccion.trim()) {
            toast.error('Por favor ingresa una dirección de entrega válida');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                restauranteId: cart.restauranteId,
                direccionEntrega: direccion,
                items: cart.items.map(i => ({
                    productId: i.productId,
                    nombre: i.nombre,
                    precioUnit: Number(i.precioUnit),
                    cantidad: i.cantidad
                }))
            };

            const res = await apiFetch('/orders', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.status === 201) {
                toast.success("¡Pedido creado exitosamente!");
                localStorage.removeItem('cart');
                setCart(null);
                router.push('/dashboard/orders');
            } else {
                const error = await res.json();
                toast.error(error.message || 'Error al crear el pedido');
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    if (!cart || cart.items.length === 0) {
        return (
            <div className="max-w-3xl mx-auto w-full text-center py-20">
                <h2 className="text-2xl font-bold mb-4">Tu carrito está vacío</h2>
                <Button onClick={() => router.push('/restaurants')}>Explorar Restaurantes</Button>
            </div>
        );
    }

    const subtotal = cart.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
    const costoEntrega = 1500; // COP, razonable para envíos dentro del campus en Armenia. Dato arbitrario definido en requerimientos
    const total = subtotal + costoEntrega;

    return (
        <div className="max-w-4xl mx-auto w-full">
            <PageHeader title="Tu Carrito" description="Revisa tus productos y completa tu orden." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                    {cart.items.map((item) => (
                        <Card key={item.productId} className="flex flex-row items-center justify-between p-4 bg-muted/30">
                            <div className="flex-1">
                                <h3 className="font-semibold">{item.nombre}</h3>
                                <p className="text-sm text-muted-foreground">${Number(item.precioUnit).toFixed(2)} cada uno</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center border rounded-md">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, -1)}>-</Button>
                                    <span className="w-8 text-center text-sm font-medium">{item.cantidad}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, 1)}>+</Button>
                                </div>
                                <div className="font-semibold w-16 text-right">${Number(item.subtotal).toFixed(2)}</div>
                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => {
                                    updateQuantity(item.productId, -item.cantidad);
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}

                    <Button variant="link" className="text-destructive px-0" onClick={clearCart}>
                        Vaciar Carrito
                    </Button>

                    <div className="mt-8">
                        <h3 className="font-semibold mb-2">Dirección de Entrega</h3>
                        <Input
                            placeholder="Ej: Biblioteca Central, 3er piso"
                            value={direccion}
                            onChange={(e) => setDireccion(e.target.value)}
                            className="max-w-md"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Asegúrate de dar descripciones precisas para que el repartidor te encuentre rápido.
                        </p>
                    </div>
                </div>

                <div className="md:col-span-1">
                    <Card className="sticky top-24">
                        <CardHeader className="pb-4">
                            <CardTitle>Resumen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Costo Entrega</span>
                                <span>${costoEntrega.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-4 flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" size="lg" onClick={submitOrder} disabled={isLoading}>
                                {isLoading ? 'Procesando...' : 'Confirmar Pedido'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
