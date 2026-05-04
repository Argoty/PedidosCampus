'use client';
import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Bot, Send, User } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'agent';
    content: string;
}

export default function AdminAIAgentPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'agent', content: 'Hola administrador. Soy tu asistente de Inteligencia Artificial para PedidosCampus. ¿En qué te puedo ayudar hoy? Puedo analizar métricas, identificar usuarios problemáticos o sugerir optimizaciones.' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTyping(true);

        // Simulated API call just for UI prototype
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'agent', content: `He analizado tu consulta sobre "${userMsg}". Actualmente el sistema opera con normalidad y el tiempo promedio de entrega es de 14.5 minutos. (Esta es una respuesta simulada prototipo)` }]);
        }, 1500);
    };

    return (
        <div className="max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-140px)]">
            <PageHeader title="Agente IA" description="Asesor virtual exclusivo para administradores." />

            <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm max-h-[800px]">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-muted/10">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                            {m.role === 'agent' && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Bot className="text-primary-foreground w-5 h-5" />
                                </div>
                            )}

                            <div
                                className={`max-w-[80%] px-5 py-3 rounded-2xl ${m.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                        : 'bg-card text-card-foreground border shadow-sm rounded-tl-sm'
                                    }`}
                            >
                                <div className="text-sm md:text-base leading-relaxed">{m.content}</div>
                            </div>

                            {m.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                    <User className="text-secondary-foreground w-5 h-5" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-4 justify-start">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <Bot className="text-primary-foreground w-5 h-5" />
                            </div>
                            <div className="max-w-[80%] px-5 py-3 bg-card border shadow-sm rounded-2xl rounded-tl-sm flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <div className="p-4 border-t bg-card">
                    <form onSubmit={handleSend} className="flex gap-2 relative">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Pregúntame sobre operaciones, métricas o usuarios..."
                            className="pr-12 py-6 rounded-full"
                        />
                        <Button type="submit" size="icon" disabled={!input.trim() || isTyping} className="absolute right-1 top-1 h-10 w-10 rounded-full">
                            <Send className="w-5 h-5" />
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
}
