'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ClipboardList, Plus, Store, CheckCircle, XCircle, Users } from 'lucide-react';

interface Restaurant {
    id: string;
    nombre: string;
    direccion: string;
    categoria: string;
    imagenUrl?: string;
    isActive: boolean;
}

interface RestaurantApi extends Restaurant {
    imagen_url?: string;
    is_active?: boolean;
}

export default function AdminRestaurantsPage() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRests = async () => {
        try {
            // To fetch both active and inactive given python's query param default
            const [activesFetch, inactivesFetch] = await Promise.all([
                apiFetch('/restaurants?is_active=true'),
                apiFetch('/restaurants?is_active=false')
            ]);

            let activeData: RestaurantApi[] = [];
            let inactiveData: RestaurantApi[] = [];
            if (activesFetch.ok) {
                const dataA = await activesFetch.json();
                activeData = Array.isArray(dataA) ? (dataA as RestaurantApi[]) : (dataA.items || dataA.data || []);
            }
            if (inactivesFetch.ok) {
                const dataI = await inactivesFetch.json();
                inactiveData = Array.isArray(dataI) ? (dataI as RestaurantApi[]) : (dataI.items || dataI.data || []);
            }

            const normalize = (items: RestaurantApi[]) => items.map(item => ({
                ...item,
                isActive: item.isActive ?? item.is_active ?? false,
                imagenUrl: item.imagenUrl || item.imagen_url
            }));

            setRestaurants(normalize([...activeData, ...inactiveData]));
        } catch {
            toast.error('Error al cargar restaurantes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRests();
    }, []);

    const toggleActive = async (id: string, current: boolean) => {
        try {
            const action = current ? 'deactivate' : 'activate';
            const res = await apiFetch(`/restaurants/${id}/${action}`, { method: 'POST' });
            if (res.ok) {
                toast.success(`Restaurante ${current ? 'desactivado' : 'activado'}`);
                setRestaurants(prev => prev.map(r => r.id === id ? { ...r, isActive: !current } : r));
            } else {
                toast.error('No se pudo actualizar el estado');
            }
        } catch {
            toast.error('Error de red');
        }
    };

    return (
        <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <PageHeader title="Gestión de Restaurantes" description="Añade, edita y administra locales y menús." />
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.location.href = '/admin/users'}>
                        <Users className="mr-2 h-4 w-4" /> Usuarios
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = '/admin/orders'}>
                        <ClipboardList className="mr-2 h-4 w-4" /> Ver Pedidos
                    </Button>
                    <Button onClick={() => window.location.href = '/admin/restaurants/new'}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Restaurante
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {restaurants.map(rest => (
                        <Card key={rest.id} className="flex flex-col">
                            <div
                                className="w-full h-32 bg-muted rounded-t-xl"
                                style={{
                                    backgroundImage: rest.imagenUrl ? `url(${rest.imagenUrl})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            >
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-xl line-clamp-1">{rest.nombre}</CardTitle>
                                    <Badge variant="secondary">{rest.categoria}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm font-medium">Estado: <span className={rest.isActive ? 'text-green-600' : 'text-red-500'}>{rest.isActive ? 'Operativo' : 'Inactivo'}</span></div>
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => window.location.href = `/restaurants/${rest.id}`}>
                                    <Store className="mr-2 h-4 w-4" /> Ver Menú
                                </Button>
                                <Button
                                    variant={rest.isActive ? 'destructive' : 'default'}
                                    className="flex-1"
                                    onClick={() => toggleActive(rest.id, rest.isActive)}
                                >
                                    {rest.isActive ? <><XCircle className="mr-2 h-4 w-4" /> Desactivar</> : <><CheckCircle className="mr-2 h-4 w-4" /> Activar</>}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
