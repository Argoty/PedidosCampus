import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Toaster } from '@/components/ui/sonner';

export function Shell({ children }: { children: ReactNode }) {
    return (
        <>
            <Navbar />
            <main className="flex-1 flex flex-col container mx-auto px-4 py-6 md:py-8 w-full max-w-7xl">
                {children}
            </main>
            <Toaster />
        </>
    );
}
