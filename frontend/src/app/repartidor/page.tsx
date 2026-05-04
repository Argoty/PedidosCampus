'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function RepartidorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await apiFetch('/api/profiles/me');
                if (res.ok) {
                    setProfile(await res.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const toggleAvailability = async () => {
        if (!profile) return;
        const previous = profile.disponible;
        setProfile({ ...profile, disponible: !previous });

        try {
            const res = await apiFetch('/api/profiles/me/availability', {
                method: 'POST',
                body: JSON.stringify({ disponible: !previous })
            });
            if (!res.ok) {
                throw new Error("Failed to change availability");
            }
            toast.success(!previous ? 'Ahora estás disponible para recibir pedidos' : 'Te has desconectado');
        } catch {
            toast.error('No se pudo actualizar la disponibilidad');
            setProfile({ ...profile, disponible: previous });
        }
    };

    if (isLoading) {
        return <div className="max-w-2xl mx-auto"><Skeleton className="h-48 w-full" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto w-full space-y-6">
            <PageHeader
                title="Panel de Repartidor"
                description="Administra tu disponibilidad y accede a tus pedidos asignados."
            />

            <Card className="border-primary/20 bg-muted/10 shadow-sm">
                <CardHeader>
                    <CardTitle>Tu Estado Actual</CardTitle>
                    <CardDescription>
                        {profile?.disponible
                            ? "Estás DISPONIBLE para recibir asignaciones."
                            : "Actualmente estás DESCONECTADO."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${profile?.disponible ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="font-semibold text-lg">{profile?.disponible ? 'Conectado' : 'Desconectado'}</span>
                    </div>
                    <Button
                        variant={profile?.disponible ? 'destructive' : 'default'}
                        size="lg"
                        onClick={toggleAvailability}
                    >
                        {profile?.disponible ? 'Desconectarse' : 'Ponerme Disponible'}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Pedidos Asignados</CardTitle>
                        <CardDescription>Revisa los pedidos que tienes en camino.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/repartidor/orders">
                            <Button className="w-full" variant="outline">Ver mis asignaciones</Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Mi Perfil</CardTitle>
                        <CardDescription>Ajusta tus datos y preferencias.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/profile">
                            <Button className="w-full" variant="outline">Editar perfil</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
