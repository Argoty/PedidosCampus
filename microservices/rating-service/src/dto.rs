use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateRatingRequest {
    pub pedido_id: Uuid,
    pub restaurante_id: Option<Uuid>,
    pub repartidor_id: Option<Uuid>,
    pub estrellas: i32,
    pub comentario: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateRatingRequest {
    pub estrellas: Option<i32>,
    pub comentario: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RatingResponse {
    pub id: Uuid,
    pub pedido_id: Uuid,
    pub user_id: Uuid,
    pub restaurante_id: Option<Uuid>,
    pub repartidor_id: Option<Uuid>,
    pub estrellas: i32,
    pub comentario: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ListRatingsResponse {
    pub data: Vec<RatingResponse>,
    pub pagination: PaginationInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<StatsInfo>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginationInfo {
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatsInfo {
    pub average_rating: f64,
    pub total_ratings: i64,
    pub distribution: DistributionInfo,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DistributionInfo {
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

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
}
