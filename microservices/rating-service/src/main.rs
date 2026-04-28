use rating_service::{app, config};
use std::env;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("info".parse().unwrap()),
        )
        .init();

    // Initialize database
    let db_pool = config::init_db_pool()
        .await
        .expect("Failed to initialize database");

    // Create app
    let app = app::create_app(db_pool);

    // Get port
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8003".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid number");

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .expect("Failed to bind to port");

    tracing::info!("Server running on http://0.0.0.0:{}", port);

    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
