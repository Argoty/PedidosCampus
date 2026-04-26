use axum::{
    routing::{get, post, patch, delete},
    Router,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use crate::{
    state::AppState,
    restaurant_handler::*,
    delivery_handler::*,
    dto::*,
    models::*,
};

#[derive(OpenApi)]
#[openapi(
    paths(
        create_restaurant_rating,
        get_restaurant_rating,
        get_user_restaurant_ratings,
        get_restaurant_ratings,
        update_restaurant_rating,
        delete_restaurant_rating,
        get_restaurant_stats,
        create_delivery_rating,
        get_delivery_rating,
        get_user_delivery_ratings,
        get_delivery_ratings,
        update_delivery_rating,
        delete_delivery_rating,
        get_delivery_stats,
    ),
    components(
        schemas(
            RestaurantRating,
            DeliveryRating,
            RatingStats,
            RatingDistribution,
            CreateRatingRequest,
            UpdateRatingRequest,
            RatingResponse,
            ListRatingsResponse,
            PaginationInfo,
            StatsInfo,
            DistributionInfo,
            HealthResponse,
        )
    ),
    info(
        title = "Rating Service API",
        description = "Microservicio de calificaciones para restaurantes y repartidores",
        version = "0.1.0"
    ),
)]
pub struct ApiDoc;

pub fn create_routes() -> Router<AppState> {
    let openapi = ApiDoc::openapi();
    
    Router::new()
        // Restaurant ratings
        .route("/ratings/restaurant", post(create_restaurant_rating))
        .route("/ratings/restaurant/:id", get(get_restaurant_rating))
        .route("/ratings/restaurant/user/:userId", get(get_user_restaurant_ratings))
        .route("/ratings/restaurant/restaurant/:restauranteId", get(get_restaurant_ratings))
        .route("/ratings/restaurant/:id", patch(update_restaurant_rating))
        .route("/ratings/restaurant/:id", delete(delete_restaurant_rating))
        .route("/ratings/stats/restaurant/:restauranteId", get(get_restaurant_stats))
        // Delivery ratings
        .route("/ratings/delivery", post(create_delivery_rating))
        .route("/ratings/delivery/:id", get(get_delivery_rating))
        .route("/ratings/delivery/user/:userId", get(get_user_delivery_ratings))
        .route("/ratings/delivery/delivery/:repartidorId", get(get_delivery_ratings))
        .route("/ratings/delivery/:id", patch(update_delivery_rating))
        .route("/ratings/delivery/:id", delete(delete_delivery_rating))
        .route("/ratings/stats/delivery/:repartidorId", get(get_delivery_stats))
        // Health
        .route("/health", get(health_check))
        // Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi))
}

pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "service": "rating-service"
    }))
}
