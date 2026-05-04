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
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                const data = await res.json();
                // Assuming /auth/login returns { accessToken, role, user: { id... } }
                const userRole = data.user?.role || data.role || 'usuario';
                login(data.accessToken, userRole, data.user || { id: data.id });

                toast.success(`Bienvenido de vuelta!`);

                if (userRole === 'admin') router.push('/admin/orders');
                else if (userRole === 'repartidor') router.push('/repartidor');
                else router.push('/restaurants');
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.message || 'Error de credenciales');
            }
        } catch (err) {
            toast.error('No se pudo conectar al servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-160px)]">
            <Card className="w-full max-w-md shadow-lg border-muted/50">
                <CardHeader className="space-y-2 text-center pb-6">
                    <CardTitle className="text-3xl font-bold tracking-tight">Iniciar Sesión</CardTitle>
                    <CardDescription>
                        Ingresa a tu cuenta de PedidosCampus
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="email">Correo electrónico</label>
                            <Input
                                id="email"
                                type="email"
                                required
                                placeholder="estudiante@campus.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
                            </div>
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
                        <Button className="w-full h-11 font-medium mt-6" type="submit" disabled={isLoading}>
                            {isLoading ? 'Iniciando...' : 'Ingresar'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t p-6">
                    <div className="text-sm text-muted-foreground w-full text-center">
                        ¿No tienes cuenta?{' '}
                        <Link href="/register" className="font-semibold text-primary hover:underline">
                            Regístrate
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
