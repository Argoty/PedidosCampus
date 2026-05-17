use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;

pub async fn init_db_pool() -> Result<PgPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://rating_user:rating_password@localhost:5437/rating_db".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // Run migrations - each statement separately (SQLx doesn't support multiple statements in one query)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS calificaciones_restaurante (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pedido_id UUID NOT NULL,
            user_id UUID NOT NULL,
            restaurante_id UUID NOT NULL,
            estrellas INT NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
            comentario VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(pedido_id, user_id)
        )
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_restaurante_id ON calificaciones_restaurante(restaurante_id)"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_id ON calificaciones_restaurante(user_id)"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS calificaciones_repartidor (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pedido_id UUID NOT NULL,
            user_id UUID NOT NULL,
            repartidor_id UUID NOT NULL,
            estrellas INT NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
            comentario VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(pedido_id, user_id)
        )
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_repartidor_id ON calificaciones_repartidor(repartidor_id)"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_user_id ON calificaciones_repartidor(user_id)"
    )
    .execute(&pool)
    .await?;

    // Create pedidos_entregados table for delivered orders tracking
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS pedidos_entregados (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pedido_id UUID NOT NULL UNIQUE,
            user_id UUID NOT NULL,
            repartidor_id UUID NOT NULL,
            restaurante_id UUID NOT NULL,
            delivered_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pedidos_entregados_pedido_id ON pedidos_entregados(pedido_id)"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pedidos_entregados_user_id ON pedidos_entregados(user_id)"
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pedidos_entregados_repartidor_id ON pedidos_entregados(repartidor_id)"
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
