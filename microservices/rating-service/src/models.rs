use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct RestaurantRating {
    pub id: Uuid,
    pub pedido_id: Uuid,
    pub user_id: Uuid,
    pub restaurante_id: Uuid,
    pub estrellas: i32,
    pub comentario: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct DeliveryRating {
    pub id: Uuid,
    pub pedido_id: Uuid,
    pub user_id: Uuid,
    pub repartidor_id: Uuid,
    pub estrellas: i32,
    pub comentario: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RatingStats {
    pub average_rating: f64,
    pub total_ratings: i64,
    pub distribution: RatingDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RatingDistribution {
    #[serde(rename = "5")]
    pub stars_5: i64,
    #[serde(rename = "4")]
    pub stars_4: i64,
    #[serde(rename = "3")]
    pub stars_3: i64,
    #[serde(rename = "2")]
    pub stars_2: i64,
    #[serde(rename = "1")]
    pub stars_1: i64,
}
