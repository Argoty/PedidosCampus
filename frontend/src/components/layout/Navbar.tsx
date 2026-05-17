'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShoppingCart, LogOut, User as UserIcon, Menu, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

export function Navbar() {
    const { user, logout } = useAuth();

    const getDashboardLink = () => {
        if (user?.role === 'admin') return '/admin/orders';
        if (user?.role === 'repartidor') return '/repartidor';
        return '/dashboard/orders';
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left">
                            <SheetTitle className="text-lg font-bold text-primary mb-4">Menú</SheetTitle>
                            <nav className="flex flex-col gap-4 mt-2">
                                <Link href="/" className="text-lg font-bold text-primary">PedidosCampus</Link>
                                <Link href="/restaurants" className="text-sm font-medium hover:text-primary transition-colors">Restaurantes</Link>
                                {user ? (
                                    <>
                                        <Link href={getDashboardLink()} className="text-sm font-medium hover:text-primary transition-colors">Mi Panel ({user.role})</Link>
                                        {user.role === 'usuario' && (
                                            <Link href="/dashboard/cart" className="text-sm font-medium hover:text-primary transition-colors">Carrito</Link>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-2 mt-4">
                                        <Link href="/login"><Button variant="outline" className="w-full">Iniciar sesión</Button></Link>
                                        <Link href="/register"><Button className="w-full">Registrarse</Button></Link>
                                    </div>
                                )}
                            </nav>
                        </SheetContent>
                    </Sheet>

                    <Link href="/" className="hidden md:flex items-center gap-2">
                        <span className="text-xl font-heading font-bold text-primary">PedidosCampus</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 ml-6">
                        <Link href="/restaurants" className="text-sm font-medium hover:text-primary transition-colors">Restaurantes</Link>
                        {user && (
                            <Link href={getDashboardLink()} className="text-sm font-medium hover:text-primary transition-colors">
                                Mi Panel
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            {user.role === 'usuario' && (
                                <Link href="/dashboard/cart">
                                    <Button variant="ghost" size="icon" className="relative">
                                        <ShoppingCart className="h-5 w-5 hover:text-primary transition-colors" />
                                    </Button>
                                </Link>
                            )}
                            <Link href="/dashboard/notifications">
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5 hover:text-primary transition-colors" />
                                </Button>
                            </Link>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {user.nombre ? user.nombre.charAt(0) : user.role.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.nombre || user.role}</p>
                                            <p className="text-xs leading-none text-muted-foreground truncate w-full" title={user.id}>
                                                {user.id}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => window.location.href = '/dashboard/profile'} className="cursor-pointer">
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        <span>Perfil</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Cerrar sesión</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <div className="hidden md:flex items-center gap-2">
                            <Link href="/login">
                                <Button variant="ghost">Iniciar sesión</Button>
                            </Link>
                            <Link href="/register">
                                <Button>Registrarse</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
