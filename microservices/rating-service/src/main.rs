use rating_service::{app, config, delivered_order_service, delivered_order_repo, rabbitmq};
use std::env;
use std::sync::Arc;
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

    // Initialize delivered order repository and service
    let delivered_order_repo = delivered_order_repo::DeliveredOrderRepository::new(db_pool.clone());
    let delivered_order_service = Arc::new(delivered_order_service::DeliveredOrderService::new(delivered_order_repo));

    // Start RabbitMQ consumer as background task
    let rabbitmq_url = env::var("RABBITMQ_URL").unwrap_or_else(|_| "amqp://guest:guest@rabbitmq:5672/".into());
    let exchange = env::var("RABBITMQ_EXCHANGE").unwrap_or_else(|_| "orders".into());
    let queue = env::var("RABBITMQ_QUEUE").unwrap_or_else(|_| "rating-service".into());

    tracing::info!("Starting RabbitMQ consumer with URL: {}, exchange: {}, queue: {}", 
        rabbitmq_url, exchange, queue);

    match rabbitmq::consumer::start_consumer(&rabbitmq_url, &exchange, &queue, delivered_order_service.clone()).await {
        Ok(_) => {
            tracing::info!("✅ RabbitMQ consumer started successfully");
        }
        Err(e) => {
            tracing::error!("❌ Failed to start RabbitMQ consumer: {:?}", e);
            tracing::warn!("Service will continue but will NOT receive order.delivered events");
        }
    }

    // Create app with state
    let app = app::create_app(db_pool, delivered_order_service);

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
