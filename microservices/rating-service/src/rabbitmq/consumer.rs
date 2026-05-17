use futures::StreamExt;
use lapin::{Connection, ConnectionProperties};
use lapin::options::{QueueDeclareOptions, ExchangeDeclareOptions, BasicConsumeOptions};
use lapin::types::FieldTable;
use serde::Deserialize;
use std::sync::Arc;

use super::super::delivered_order_service::DeliveredOrderService;
use super::super::errors::AppError;

#[derive(Debug, Deserialize)]
struct OrderDeliveredEvent {
    #[allow(dead_code)]
    event_id: String,
    #[allow(dead_code)]
    event_type: String,
    order_id: String,
    user_id: String,
    repartidor_id: String,
    restaurante_id: String,
    delivered_at: String,
}

pub async fn start_consumer(
    rabbitmq_url: &str,
    exchange: &str,
    queue: &str,
    delivered_order_service: Arc<DeliveredOrderService>,
) -> Result<(), AppError> {
    tracing::info!("Attempting to connect to RabbitMQ at {}", rabbitmq_url);
    
    let conn = Connection::connect(rabbitmq_url, ConnectionProperties::default())
        .await
        .map_err(|e| {
            let error_msg = format!("RabbitMQ connection failed: {:?}", e);
            tracing::error!("{}", error_msg);
            AppError::InternalError(error_msg)
        })?;
    
    tracing::info!("Connected to RabbitMQ, creating channel...");
    
    let channel = conn.create_channel()
        .await
        .map_err(|e| {
            let error_msg = format!("Channel creation failed: {:?}", e);
            tracing::error!("{}", error_msg);
            AppError::InternalError(error_msg)
        })?;

     // Declare exchange (topic)
     tracing::info!("Declaring exchange: {} (type: topic)", exchange);
     channel.exchange_declare(
         exchange,
         lapin::ExchangeKind::Topic,
         ExchangeDeclareOptions {
             durable: true,
             ..Default::default()
         },
         FieldTable::default(),
     )
     .await
     .map_err(|e| {
         let error_msg = format!("Exchange declare failed: {:?}", e);
         tracing::error!("{}", error_msg);
         AppError::InternalError(error_msg)
     })?;

     // Declare queue
     tracing::info!("Declaring queue: {}", queue);
     channel.queue_declare(
         queue,
         QueueDeclareOptions {
             durable: true,
             ..Default::default()
         },
         FieldTable::default(),
     )
     .await
     .map_err(|e| {
         let error_msg = format!("Queue declare failed: {:?}", e);
         tracing::error!("{}", error_msg);
         AppError::InternalError(error_msg)
     })?;

     // Bind queue to exchange with routing key
     tracing::info!("Binding queue '{}' to exchange '{}' with routing key 'order.delivered'", queue, exchange);
     channel.queue_bind(
         queue,
         exchange,
         "order.delivered",
         Default::default(),
         FieldTable::default(),
     )
     .await
     .map_err(|e| {
         let error_msg = format!("Queue bind failed: {:?}", e);
         tracing::error!("{}", error_msg);
         AppError::InternalError(error_msg)
     })?;

     // Consume messages
     tracing::info!("Starting basic consume on queue: {}", queue);
     let mut consumer = channel.basic_consume(
         queue,
         "rating-service-consumer",
         BasicConsumeOptions::default(),
         FieldTable::default(),
     )
     .await
     .map_err(|e| {
         let error_msg = format!("Basic consume failed: {:?}", e);
         tracing::error!("{}", error_msg);
         AppError::InternalError(error_msg)
     })?;

    tracing::info!("✅ RabbitMQ consumer initialized, spawning background task...");

    tokio::spawn(async move {
        tracing::info!("🚀 RabbitMQ consumer background task started, waiting for messages on routing key 'order.delivered'...");
        
        while let Some(delivery_result) = consumer.next().await {
            match delivery_result {
                Ok(delivery) => {
                    let payload = String::from_utf8_lossy(&delivery.data);
                    tracing::debug!("Message received: {}", payload);

                    match serde_json::from_str::<OrderDeliveredEvent>(&payload) {
                        Ok(event) => {
                            // Validate all UUIDs before parsing
                            let order_id = match uuid::Uuid::parse_str(&event.order_id) {
                                Ok(id) => id,
                                Err(e) => {
                                    tracing::warn!("Invalid order_id UUID in event: {:?}", e);
                                    let _ = delivery.nack(Default::default()).await;
                                    continue;
                                }
                            };
                            
                            let user_id = match uuid::Uuid::parse_str(&event.user_id) {
                                Ok(id) => id,
                                Err(e) => {
                                    tracing::warn!("Invalid user_id UUID in event: {:?}", e);
                                    let _ = delivery.nack(Default::default()).await;
                                    continue;
                                }
                            };
                            
                            let repartidor_id = match uuid::Uuid::parse_str(&event.repartidor_id) {
                                Ok(id) => id,
                                Err(e) => {
                                    tracing::warn!("Invalid repartidor_id UUID in event: {:?}", e);
                                    let _ = delivery.nack(Default::default()).await;
                                    continue;
                                }
                            };
                            
                            let restaurante_id = match uuid::Uuid::parse_str(&event.restaurante_id) {
                                Ok(id) => id,
                                Err(e) => {
                                    tracing::warn!("Invalid restaurante_id UUID in event: {:?}", e);
                                    let _ = delivery.nack(Default::default()).await;
                                    continue;
                                }
                            };
                            
                            let delivered_at = match chrono::DateTime::parse_from_rfc3339(&event.delivered_at) {
                                Ok(dt) => dt.with_timezone(&chrono::Utc),
                                Err(e) => {
                                    tracing::warn!("Invalid delivered_at datetime in event: {:?}", e);
                                    let _ = delivery.nack(Default::default()).await;
                                    continue;
                                }
                            };

                            if let Err(e) = delivered_order_service.register_delivered_order(
                                order_id,
                                user_id,
                                repartidor_id,
                                restaurante_id,
                                delivered_at,
                            ).await {
                                tracing::error!("Error registering delivered order: {:?}", e);
                                let _ = delivery.nack(Default::default()).await;
                            } else {
                                let _ = delivery.ack(Default::default()).await;
                            }
                        }
                        Err(e) => {
                            tracing::error!("Error parsing event JSON: {:?}", e);
                             let _ = delivery.nack(Default::default()).await;
                        }
                    }
                }
                Err(e) => tracing::error!("Consumer error: {:?}", e),
            }
        }
    });

    Ok(())
}
