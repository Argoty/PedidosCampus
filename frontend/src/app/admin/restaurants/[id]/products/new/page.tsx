'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NuevoProductoPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        precio: '',
        disponible: true
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            precio: parseFloat(formData.precio)
        };

        try {
            const res = await apiFetch(`/restaurants/${unwrappedParams.id}/products`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Producto creado y agregado al menú');
                router.push(`/restaurants/${unwrappedParams.id}`);
            } else {
                const err = await res.json();
                toast.error(err.message || 'Error al crear producto');
            }
        } catch {
            toast.error('Error de red al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto w-full">
            <PageHeader title="Nuevo Producto" description="Agrega platos o elementos al menú de este restaurante." />

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="nombre">Nombre del Producto</label>
                            <Input id="nombre" value={formData.nombre} onChange={handleChange} required placeholder="Ej. Hamburguesa Especial" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="precio">Precio ($)</label>
                            <Input id="precio" type="number" min="0" step="0.01" value={formData.precio} onChange={handleChange} required placeholder="Ej. 12.50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="descripcion">Descripción (opcional)</label>
                            <Input id="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Ej. Doble carne, queso, papas fritas..." />
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row gap-4">
                            <Button type="button" variant="outline" className="w-full sm:flex-1 h-11 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={() => router.push(`/restaurants/${unwrappedParams.id}`)}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:flex-1 h-11 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                                {loading ? 'Guardando...' : 'Crear Producto'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
