-- Create pedidos_entregados table to track delivered orders eligible for rating
CREATE TABLE IF NOT EXISTS pedidos_entregados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    repartidor_id UUID NOT NULL,
    restaurante_id UUID NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pedidos_entregados_user_id ON pedidos_entregados(user_id);
CREATE INDEX idx_pedidos_entregados_restaurante_id ON pedidos_entregados(restaurante_id);
CREATE INDEX idx_pedidos_entregados_repartidor_id ON pedidos_entregados(repartidor_id);
