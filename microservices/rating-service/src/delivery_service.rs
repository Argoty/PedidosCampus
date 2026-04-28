use uuid::Uuid;
use chrono::Utc;
use crate::errors::Result;
use crate::models::DeliveryRating;
use crate::delivery_repository::DeliveryRatingRepository;

pub struct DeliveryRatingService {
    repo: DeliveryRatingRepository,
}

impl DeliveryRatingService {
    pub fn new(repo: DeliveryRatingRepository) -> Self {
        Self { repo }
    }

    pub async fn create(&self, pedido_id: Uuid, repartidor_id: Uuid, user_id: Uuid, estrellas: i32, comentario: Option<String>) -> Result<DeliveryRating> {
        if estrellas < 1 || estrellas > 5 {
            return Err(crate::errors::AppError::ValidationError("estrellas must be between 1 and 5".to_string()));
        }

        let rating = DeliveryRating {
            id: Uuid::new_v4(),
            pedido_id,
            user_id,
            repartidor_id,
            estrellas,
            comentario,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.repo.create(&rating).await
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<DeliveryRating> {
        self.repo.get_by_id(id).await
    }

    pub async fn get_by_user(&self, user_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<DeliveryRating>, i64)> {
        let limit = limit.min(50).max(1);
        let offset = offset.max(0);
        self.repo.get_by_user(user_id, limit, offset).await
    }

    pub async fn get_by_delivery(&self, repartidor_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<DeliveryRating>, i64)> {
        let limit = limit.min(50).max(1);
        let offset = offset.max(0);
        self.repo.get_by_delivery(repartidor_id, limit, offset).await
    }

    pub async fn update(&self, id: Uuid, estrellas: Option<i32>, comentario: Option<String>) -> Result<DeliveryRating> {
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

    pub async fn get_stats(&self, repartidor_id: Uuid) -> Result<(f64, i64, (i64, i64, i64, i64, i64))> {
        self.repo.get_stats(repartidor_id).await
    }
}
