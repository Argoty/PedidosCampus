use std::sync::Arc;
use axum::{
    http::StatusCode,
    Router,
};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use crate::{routes::create_routes, state::AppState};
use crate::delivered_order_service::DeliveredOrderService;

pub fn create_app(db_pool: PgPool, delivered_order_service: Arc<DeliveredOrderService>) -> Router {
    let app_state = AppState::new(db_pool, delivered_order_service);

    let middleware = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    create_routes()
        .layer(middleware)
        .with_state(app_state)
        .fallback(handler_404)
}

async fn handler_404() -> (StatusCode, String) {
    (StatusCode::NOT_FOUND, "Not found".to_string())
}
