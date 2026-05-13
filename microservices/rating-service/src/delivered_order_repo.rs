use sqlx::PgPool;
use uuid::Uuid;
use crate::models::DeliveredOrder;
use crate::errors::AppError;

pub struct DeliveredOrderRepository {
    pool: PgPool,
}

impl DeliveredOrderRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, order: &DeliveredOrder) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO pedidos_entregados (id, pedido_id, user_id, repartidor_id, restaurante_id, delivered_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (pedido_id) DO NOTHING
            "#
        )
        .bind(order.id)
        .bind(order.pedido_id)
        .bind(order.user_id)
        .bind(order.repartidor_id)
        .bind(order.restaurante_id)
        .bind(order.delivered_at)
        .bind(order.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn exists_by_pedido_id(&self, pedido_id: Uuid) -> Result<bool, AppError> {
        let result: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM pedidos_entregados WHERE pedido_id = $1)"
        )
        .bind(pedido_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(result)
    }
}
