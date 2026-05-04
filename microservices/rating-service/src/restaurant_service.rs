use uuid::Uuid;
use chrono::Utc;
use crate::errors::Result;
use crate::models::RestaurantRating;
use crate::restaurant_repository::RestaurantRatingRepository;
use crate::delivered_order_service::DeliveredOrderService;

#[derive(Clone)]
pub struct RestaurantRatingService {
    repo: RestaurantRatingRepository,
    delivered_order_service: std::sync::Arc<DeliveredOrderService>,
}

impl RestaurantRatingService {
    pub fn new(repo: RestaurantRatingRepository, delivered_order_service: std::sync::Arc<DeliveredOrderService>) -> Self {
        Self { repo, delivered_order_service }
    }

    pub async fn create(&self, pedido_id: Uuid, restaurante_id: Uuid, user_id: Uuid, estrellas: i32, comentario: Option<String>) -> Result<RestaurantRating> {
        if estrellas < 1 || estrellas > 5 {
            return Err(crate::errors::AppError::ValidationError("estrellas must be between 1 and 5".to_string()));
        }

        // Validate that the order was delivered
        let is_delivered = self.delivered_order_service.is_order_delivered(pedido_id).await?;
        if !is_delivered {
            return Err(crate::errors::AppError::ValidationError("El pedido no ha sido entregado".to_string()));
        }

        let rating = RestaurantRating {
            id: Uuid::new_v4(),
            pedido_id,
            user_id,
            restaurante_id,
            estrellas,
            comentario,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.repo.create(&rating).await
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<RestaurantRating> {
        self.repo.get_by_id(id).await
    }

    pub async fn get_by_user(&self, user_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<RestaurantRating>, i64)> {
        let limit = limit.min(50).max(1);
        let offset = offset.max(0);
        self.repo.get_by_user(user_id, limit, offset).await
    }

    pub async fn get_by_restaurant(&self, restaurante_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<RestaurantRating>, i64)> {
        let limit = limit.min(50).max(1);
        let offset = offset.max(0);
        self.repo.get_by_restaurant(restaurante_id, limit, offset).await
    }

    pub async fn update(&self, id: Uuid, estrellas: Option<i32>, comentario: Option<String>) -> Result<RestaurantRating> {
        if let Some(stars) = estrellas {
            if stars < 1 || stars > 5 {
                return Err(crate::errors::AppError::ValidationError("estrellas must be between 1 and 5".to_string()));
            }
        }
        self.repo.update(id, estrellas, comentario).await
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        self.repo.delete(id).await
    }

    pub async fn get_stats(&self, restaurante_id: Uuid) -> Result<(f64, i64, (i64, i64, i64, i64, i64))> {
        self.repo.get_stats(restaurante_id).await
    }
}
