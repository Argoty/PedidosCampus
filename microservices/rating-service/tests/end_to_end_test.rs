/// End-to-end test: publish order.delivered event to RabbitMQ, verify rating-service processes it
/// 
/// Requires:
/// - RabbitMQ running on localhost:5672
/// - rating-service running on localhost:8003
/// - rating_db running on localhost:5437
/// 
/// Run with: cargo test --test end_to_end_test -- --ignored --test-threads=1 --nocapture

use sqlx::postgres::PgPoolOptions;
use serde_json::json;
use uuid::Uuid;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::test]
#[ignore] // Run manually when stack is up
async fn test_order_delivered_event_flow() {
    println!("\n=== END-TO-END TEST: order.delivered event ===\n");

    // Step 1: Connect to RabbitMQ and publish event
    println!("Step 1️⃣: Publishing order.delivered event to RabbitMQ...");
    
    let order_id = Uuid::new_v4().to_string();
    let user_id = "550e8400-e29b-41d4-a716-446655440000";
    let repartidor_id = "550e8400-e29b-41d4-a716-446655440002";
    let restaurante_id = "550e8400-e29b-41d4-a716-446655440001";
    
    // Connect to RabbitMQ
    let addr = "amqp://guest:guest@127.0.0.1:5672".to_string();
    let connection = lapin::Connection::connect(&addr, Default::default())
        .await
        .expect("Failed to connect to RabbitMQ");
    
    let channel = connection
        .create_channel()
        .await
        .expect("Failed to create channel");
    
    // Declare exchange and queue
    let exchange_opts = lapin::options::ExchangeDeclareOptions {
        durable: true,
        ..Default::default()
    };
    let _exchange = channel
        .exchange_declare("orders", lapin::ExchangeKind::Topic, exchange_opts, Default::default())
        .await
        .expect("Failed to declare exchange");
    
    let queue_opts = lapin::options::QueueDeclareOptions {
        durable: true,
        ..Default::default()
    };
    let _queue = channel
        .queue_declare("rating-service", queue_opts, Default::default())
        .await
        .expect("Failed to declare queue");
    
    channel
        .queue_bind("rating-service", "orders", "order.delivered", Default::default(), Default::default())
        .await
        .expect("Failed to bind queue");
    
    // Create event payload
    let event = json!({
        "event_id": format!("evt-{}", chrono::Utc::now().timestamp()),
        "event_type": "order.delivered",
        "order_id": &order_id,
        "user_id": user_id,
        "repartidor_id": repartidor_id,
        "restaurante_id": restaurante_id,
        "delivered_at": chrono::Utc::now().to_rfc3339()
    });
    
    let payload = serde_json::to_string(&event).expect("Failed to serialize event");
    println!("  Event: {}", payload);
    
    // Publish
    channel
        .basic_publish(
            "orders",
            "order.delivered",
            Default::default(),
            payload.as_bytes(),
            Default::default(),
        )
        .await
        .expect("Failed to publish message");
    
    println!("  ✅ Event published\n");
    
    // Step 2: Wait for consumer to process
    println!("Step 2️⃣: Waiting for rating-service to consume event...");
    sleep(Duration::from_secs(3)).await;
    println!("  ⏳ Waited 3 seconds\n");
    
    // Step 3: Verify in database
    println!("Step 3️⃣: Checking rating_db for pedidos_entregados record...");
    
    let db_url = "postgresql://rating_user:rating_password@localhost:5437/rating_db";
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(db_url)
        .await
        .expect("Failed to connect to rating_db");
    
    let record: Option<(uuid::Uuid, uuid::Uuid, uuid::Uuid, uuid::Uuid)> = sqlx::query_as(
        "SELECT pedido_id, user_id, repartidor_id, restaurante_id FROM pedidos_entregados WHERE pedido_id = $1"
    )
    .bind(Uuid::parse_str(&order_id).expect("Invalid order ID"))
    .fetch_optional(&pool)
    .await
    .expect("Database query failed");
    
    match record {
        Some((pedido_id, user_uuid, repartidor_uuid, restaurante_uuid)) => {
            println!("  ✅ Record found in pedidos_entregados");
            println!("    - Order ID: {}", pedido_id);
            println!("    - User ID: {}", user_uuid);
            println!("    - Repartidor ID: {}", repartidor_uuid);
            println!("    - Restaurante ID: {}", restaurante_uuid);
            
            // Verify values
            assert_eq!(pedido_id.to_string(), order_id, "Order ID mismatch");
            assert_eq!(user_uuid.to_string(), user_id, "User ID mismatch");
            assert_eq!(repartidor_uuid.to_string(), repartidor_id, "Repartidor ID mismatch");
            assert_eq!(restaurante_uuid.to_string(), restaurante_id, "Restaurante ID mismatch");
            
            println!("\n✅ END-TO-END TEST PASSED ✅\n");
        }
        None => {
            panic!("❌ Record NOT found in pedidos_entregados for order_id: {}", order_id);
        }
    }
}
