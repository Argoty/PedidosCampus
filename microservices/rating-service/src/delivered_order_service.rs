use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::delivered_order_repo::DeliveredOrderRepository;
use crate::models::DeliveredOrder;
use crate::errors::AppError;

pub struct DeliveredOrderService {
    repo: DeliveredOrderRepository,
}

impl DeliveredOrderService {
    pub fn new(repo: DeliveredOrderRepository) -> Self {
        Self { repo }
    }

    pub async fn register_delivered_order(
        &self,
        pedido_id: Uuid,
        user_id: Uuid,
        repartidor_id: Uuid,
        restaurante_id: Uuid,
        delivered_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        let order = DeliveredOrder {
            id: Uuid::new_v4(),
            pedido_id,
            user_id,
            repartidor_id,
            restaurante_id,
            delivered_at,
            created_at: Utc::now(),
        };
        self.repo.insert(&order).await?;
        Ok(())
    }

    pub async fn is_order_delivered(&self, pedido_id: Uuid) -> Result<bool, AppError> {
        self.repo.exists_by_pedido_id(pedido_id).await
    }
}
