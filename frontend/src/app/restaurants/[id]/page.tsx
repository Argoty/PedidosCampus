'use client';

import { useEffect, useState, use } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface Product {
    id: string;
    nombre: string;
    descripcion?: string;
    precio: number;
    disponible: boolean;
}

interface CartItem {
    productId: string;
    nombre: string;
    precioUnit: number;
    cantidad: number;
    subtotal: number;
}

interface RestaurantDetail {
    id: string;
    nombre: string;
    descripcion?: string;
    direccion: string;
    categoria: string;
    imagenUrl?: string;
    productos: Product[];
}

interface RestaurantRating {
    id: string;
    estrellas: number;
    comentario?: string | null;
    created_at: string;
}

export default function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [cartCount, setCartCount] = useState(0);
    const [ratings, setRatings] = useState<RestaurantRating[]>([]);
    const [ratingStats, setRatingStats] = useState<{ average_rating: number; total_ratings: number } | null>(null);
    const [ratingsLoading, setRatingsLoading] = useState(true);

    useEffect(() => {
        const fetchRestaurant = async () => {
            try {
                const res = await apiFetch(`/restaurants/${unwrappedParams.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setRestaurant({
                        ...data,
                        imagenUrl: data.imagenUrl || data.imagen_url
                    });
                } else {
                    toast.error("Restaurante no encontrado");
                }
            } catch (err) {
                console.error(err);
                toast.error("Error al cargar restaurante");
            } finally {
                setLoading(false);
            }
        };

        const fetchRatings = async () => {
            try {
                const res = await apiFetch(`/ratings/restaurant/restaurant/${unwrappedParams.id}?limit=5&offset=0`);
                if (res.ok) {
                    const data = await res.json();
                    setRatings(data.data || []);
                    setRatingStats(data.stats || null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setRatingsLoading(false);
            }
        };

        fetchRestaurant();
        fetchRatings();
    }, [unwrappedParams.id]);

    const addToCart = (product: Product) => {
        if (!user) {
            toast.error('Inicia sesión para agregar productos al carrito', {
                action: { label: 'Iniciar sesión', onClick: () => window.location.href = '/login' }
            });
            return;
        }
        if (user.role !== 'usuario') {
            toast.error('Solo los estudiantes pueden crear pedidos');
            return;
        }

        // Very naive local storage cart for now
        try {
            const cartRaw = localStorage.getItem('cart');
            const typedCart: { restauranteId?: string; items: CartItem[] } = cartRaw
                ? JSON.parse(cartRaw)
                : { restauranteId: restaurant?.id, items: [] };

            if (typedCart.restauranteId !== restaurant?.id && typedCart.items.length > 0) {
                toast.error('No puedes pedir de distintos restaurantes a la vez. Vacía tu carrito primero.');
                return;
            }

            typedCart.restauranteId = restaurant?.id;
            const existingItem = typedCart.items.find((i) => i.productId === product.id);

            if (existingItem) {
                existingItem.cantidad += 1;
                existingItem.subtotal = existingItem.precioUnit * existingItem.cantidad;
            } else {
                typedCart.items.push({
                    productId: product.id,
                    nombre: product.nombre,
                    precioUnit: product.precio,
                    cantidad: 1,
                    subtotal: product.precio
                });
            }

            localStorage.setItem('cart', JSON.stringify(typedCart));
            toast.success(`${product.nombre} agregado al carrito`);

            // small update for UI
            setCartCount(cartCount + 1);
        } catch (e) {
            console.error("Cart error", e);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-48 w-full rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!restaurant) {
        return <div className="text-center py-12">Restaurante no encontrado.</div>;
    }

    return (
        <div className="flex flex-col gap-8">
            <div
                className="w-full h-48 md:h-64 rounded-2xl bg-muted relative overflow-hidden flex items-end p-6 border shadow-sm"
                style={{
                    backgroundImage: restaurant.imagenUrl ? `url(${restaurant.imagenUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative z-10 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl md:text-5xl font-bold font-heading">{restaurant.nombre}</h1>
                        <Badge variant="secondary" className="bg-white text-black hover:bg-gray-200">{restaurant.categoria}</Badge>
                    </div>
                    <p className="text-white/80">{restaurant.direccion}</p>
                    {restaurant.descripcion && <p className="mt-2 text-white/90 max-w-2xl">{restaurant.descripcion}</p>}
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold font-heading">Menú</h2>
                    {user?.role === 'admin' && (
                        <Button onClick={() => window.location.href = `/admin/restaurants/${restaurant.id}/products/new`}>
                            <Plus className="mr-2 h-4 w-4" /> Crear Producto
                        </Button>
                    )}
                </div>

                {(!restaurant.productos || restaurant.productos.length === 0) ? (
                    <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        Este restaurante aún no tiene productos disponibles.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {restaurant.productos.map(p => (
                            <Card key={p.id} className="flex flex-col">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-4">
                                        <CardTitle className="text-lg">{p.nombre}</CardTitle>
                                        <span className="font-bold text-primary">${Number(p.precio).toFixed(2)}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="text-sm text-muted-foreground">{p.descripcion}</p>
                                </CardContent>
                                <CardFooter className="pt-4">
                                    <Button
                                        className="w-full gap-2"
                                        disabled={!p.disponible}
                                        onClick={() => addToCart(p)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        {p.disponible ? 'Agregar' : 'Agotado'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold font-heading">Reseñas</h2>
                    {ratingStats && (
                        <div className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{ratingStats.average_rating.toFixed(1)}</span> / 5 · {ratingStats.total_ratings} opiniones
                        </div>
                    )}
                </div>
                {ratingsLoading ? (
                    <div className="grid gap-3">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : ratings.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        Aun no hay reseñas para este restaurante.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {ratings.map((rating) => (
                            <Card key={rating.id} className="border-none shadow-sm">
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-muted-foreground">
                                            {new Date(rating.created_at).toLocaleDateString('es-CO', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </div>
                                        <Badge variant="secondary" className="bg-secondary/60">
                                            {rating.estrellas} / 5
                                        </Badge>
                                    </div>
                                    {rating.comentario && (
                                        <p className="mt-2 text-sm text-foreground/90">{rating.comentario}</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
