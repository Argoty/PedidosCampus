'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Settings, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Restaurant {
    id: string;
    nombre: string;
    categoria: string;
    imagenUrl?: string;
    isActive: boolean;
}

export default function RestaurantsPage() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        // Debounce can be added later
        const fetchRestaurants = async () => {
            setLoading(true);
            try {
                const url = `/restaurants?isActive=true${search ? `&q=${search}` : ''}`;
                const res = await apiFetch(url);
                if (res.ok) {
                    const data = await res.json();
                    // Normalize and adjust based on the actual API structure
                    const items = Array.isArray(data) ? data : (data.items || data.data || []);
                    setRestaurants(items.map((item: any) => ({
                        ...item,
                        isActive: item.isActive ?? item.is_active ?? false,
                        imagenUrl: item.imagenUrl || item.imagen_url
                    })));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        // Simulate a fake request for now if the API is disconnected, but we will try fetch
        fetchRestaurants();
    }, [search]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Restaurantes"
                description="Descubre lugares increíbles para comer cerca del campus."
            >
                {user?.role === 'admin' && (
                    <Link href="/admin/restaurants">
                        <Button className="mt-2 md:mt-0"><Settings className="mr-2 h-4 w-4" /> Administrar</Button>
                    </Link>
                )}
            </PageHeader>

            <div className="relative max-w-md w-full mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar restaurantes por nombre..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-64 w-full rounded-xl" />
                    ))}
                </div>
            ) : restaurants.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl">
                    No se encontraron restaurantes.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {restaurants.map(rest => (
                        <Card key={rest.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                            <div
                                className="w-full h-48 bg-muted rounded-t-xl"
                                style={{
                                    backgroundImage: rest.imagenUrl ? `url(${rest.imagenUrl})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-xl line-clamp-1">{rest.nombre}</CardTitle>
                                    <Badge variant="secondary">{rest.categoria}</Badge>
                                </div>
                            </CardHeader>
                            <CardFooter className="pt-4 mt-auto">
                                <Link href={`/restaurants/${rest.id}`} className="w-full">
                                    <Button variant="default" className="w-full"><Store className="mr-2 h-4 w-4" /> Ver Menú</Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
