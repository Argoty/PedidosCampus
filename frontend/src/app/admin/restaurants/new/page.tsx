'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const CATEGORIAS = [
    'Hamburguesería',
    'Pizzería',
    'Comida Rápida',
    'Típica',
    'Mexicana',
    'Asiana',
    'Mariscos',
    'Vegetariano',
    'Bufalo\'s Wings',
    'Sandwiches',
    'Bebidas y Jugos',
    'Postres',
    'Arepas',
    'Otro'
];

export default function NuevoRestaurantePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        direccion: '',
        categoria: '',
        imagenUrl: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await apiFetch('/restaurants', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success('Restaurante creado exitosamente');
                router.push('/admin/restaurants');
            } else {
                const err = await res.json();
                toast.error(err.message || 'Error al crear el restaurante');
            }
        } catch {
            toast.error('Error de red');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto w-full">
            <PageHeader title="Nuevo Restaurante" description="Configura un nuevo local para la plataforma." />

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="nombre">Nombre</label>
                            <Input id="nombre" value={formData.nombre} onChange={handleChange} required placeholder="Ej. Empanadas Universitarias" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="categoria">Categoría</label>
                            <select
                                id="categoria"
                                value={formData.categoria}
                                onChange={handleChange}
                                required
                                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Selecciona una categoría</option>
                                {CATEGORIAS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="descripcion">Descripción</label>
                            <Input id="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Opcional..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="direccion">Dirección o Ubicación</label>
                            <Input id="direccion" value={formData.direccion} onChange={handleChange} required placeholder="Ej. Segundo piso de la biblioteca" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="imagenUrl">URL de Imagen (Opcional)</label>
                            <Input id="imagenUrl" type="url" value={formData.imagenUrl} onChange={handleChange} placeholder="https://..." />
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row gap-4">
                            <Button type="button" variant="outline" className="w-full sm:flex-1 h-11 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={() => router.push('/admin/restaurants')}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:flex-1 h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]" disabled={loading}>
                                {loading ? 'Guardando...' : 'Crear Restaurante'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}