use std::sync::Arc;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
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
        .layer(middleware::from_fn(check_service_token))
        .with_state(app_state)
        .fallback(handler_404)
}

async fn handler_404() -> (StatusCode, String) {
    (StatusCode::NOT_FOUND, "Not found".to_string())
}

/// Middleware que verifica el header `x-service-token` en todas las requests
/// excepto health check, swagger y OPTIONS.
/// Sigue el mismo patrón que restaurant-service.
async fn check_service_token(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip OPTIONS, health check, swagger y api-docs
    if req.method() == Method::OPTIONS
        || req.uri().path() == "/health"
        || req.uri().path().starts_with("/swagger-ui")
        || req.uri().path().starts_with("/api-docs")
    {
        return Ok(next.run(req).await);
    }

    let service_token = std::env::var("SERVICE_TOKEN").unwrap_or_default();
    let token = req
        .headers()
        .get("x-service-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if token.is_empty() || token != service_token {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}
