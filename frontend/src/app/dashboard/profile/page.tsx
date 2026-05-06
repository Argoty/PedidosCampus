'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [nombre, setNombre] = useState('');

    useEffect(() => {
        if (user && user.id !== 'unknown') {
            setTelefono(user.telefono || '');
            setDireccion(user.direccion || '');
            setNombre(user.nombre || '');
        }
    }, [user]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const isCreate = user?.id === 'unknown';
            const method = isCreate ? 'POST' : 'PATCH';
            // User service API says POST /profiles to create/link profile, PATCH /profiles/me to update
            const endpoint = isCreate ? '/api/profiles' : '/api/profiles/me';

            const payload = isCreate
                ? { tipo: user?.role, nombre, telefono, direccion }
                : { nombre, telefono, direccion };

            const res = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });

            if (res.status >= 200 && res.status < 300) {
                toast.success(isCreate ? 'Perfil creado' : 'Perfil actualizado');
                // Refresh me
                const meRes = await apiFetch('/api/profiles/me');
                if (meRes.ok) {
                    window.location.reload();
                }
            } else {
                toast.error('Error al actualizar el perfil');
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto w-full">
            <PageHeader title="Mi Perfil" description="Administra tus datos personales y direcciones de entrega." />

            <Card>
                <CardHeader>
                    <CardTitle>Información Personal</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre</label>
                            <Input
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Tu nombre completo"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Teléfono</label>
                            <Input
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                placeholder="+57 300 0000000"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dirección predeterminada</label>
                            <Input
                                value={direccion}
                                onChange={(e) => setDireccion(e.target.value)}
                                placeholder="Edificio, salón o punto de encuentro"
                            />
                        </div>
                        <Button type="submit" disabled={isLoading} className="mt-4">
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
