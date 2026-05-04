import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { Zap, Bike, Bot } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full gap-8 py-12 md:py-24 max-w-4xl mx-auto text-center">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter sm:text-5xl">
          Tu comida universitaria, <span className="text-primary">al instante</span>.
        </h1>
        <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
          La mejor plataforma para pedir comida a tus restaurantes favoritos dentro y fuera del campus,
          llevaba directamente a tu facultad por estudiantes como tú.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Link href="/restaurants">
          <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-md font-medium">
            Ver Restaurantes
          </Button>
        </Link>
        <Link href="/register">
          <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-md font-medium">
            Comenzar ahora
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 w-full text-left">
        <FeatureCard
          title="Rápido y Fácil"
          description="Encuentra lo que deseas, pide en segundos y sigue tu pedido en tiempo real."
          icon={<Zap className="h-8 w-8 text-primary" />}
        />
        <FeatureCard
          title="Entrega Local"
          description="Repartos manejados por tus mismos compañeros en tiempo libre."
          icon={<Bike className="h-8 w-8 text-primary" />}
        />
        <FeatureCard
          title="Soporte IA"
          description="Un asistente virtual analiza la plataforma para optimizar tu experiencia y la del campus."
          icon={<Bot className="h-8 w-8 text-primary" />}
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 p-6 rounded-2xl bg-card border shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
