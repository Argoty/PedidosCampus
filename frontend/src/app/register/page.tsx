'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [tipo, setTipo] = useState('usuario');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ nombre, email, password, telefono, direccion, role: tipo }),
            });

            if (res.ok) {
                const data = await res.json();
                const userRole = data.user?.role || data.role || tipo;
                login(data.accessToken, userRole, data.user || { id: data.id, nombre });
                toast.success('Cuenta creada. ¡Bienvenido!');
                if (userRole === 'admin') router.push('/admin/orders');
                else if (userRole === 'repartidor') router.push('/repartidor');
                else router.push('/restaurants');
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.message || 'Error en el registro');
            }
        } catch {
            toast.error('No se pudo conectar al servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-160px)]">
            <Card className="w-full max-w-md shadow-lg border-muted/50">
                <CardHeader className="space-y-2 text-center pb-6">
                    <CardTitle className="text-3xl font-bold tracking-tight">Únete a PedidosCampus</CardTitle>
                    <CardDescription>
                        Crea tu cuenta para pedir o empezar a repartir.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="usuario" className="w-full mb-6" onValueChange={setTipo}>
                        <TabsList className="grid w-full grid-cols-2 h-11">
                            <TabsTrigger value="usuario" className="font-medium">Soy Estudiante (Pedir)</TabsTrigger>
                            <TabsTrigger value="repartidor" className="font-medium">Soy Repartidor</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="nombre">Nombre completo</label>
                            <Input
                                id="nombre"
                                required
                                placeholder="Juan Pérez"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="email">Correo electrónico</label>
                            <Input
                                id="email"
                                type="email"
                                required
                                placeholder="juan@campus.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="telefono">Teléfono (opcional)</label>
                            <Input
                                id="telefono"
                                placeholder="+57 300 0000000"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        {tipo === 'usuario' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="direccion">Dirección habitual (opcional)</label>
                                <Input
                                    id="direccion"
                                    placeholder="Bloque 6, 4to piso"
                                    value={direccion}
                                    onChange={(e) => setDireccion(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        <Button className="w-full h-11 font-medium mt-6" type="submit" disabled={isLoading}>
                            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t p-6">
                    <div className="text-sm text-muted-foreground w-full text-center">
                        ¿Ya tienes cuenta?{' '}
                        <Link href="/login" className="font-semibold text-primary hover:underline">
                            Inicia sesión
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
