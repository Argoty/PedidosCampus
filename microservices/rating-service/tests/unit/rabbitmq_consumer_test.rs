#[cfg(test)]
mod rabbitmq_consumer_tests {
    use serde_json::json;
    use uuid::Uuid;
    
    // Mock event parser
    #[derive(Debug, serde::Deserialize)]
    struct OrderDeliveredEvent {
        event_id: String,
        event_type: String,
        order_id: String,
        user_id: String,
        repartidor_id: String,
        restaurante_id: String,
        delivered_at: String,
    }
    
    #[derive(Debug)]
    enum DeliveryAction {
        Ack,
        Nack,
        Error,
    }
    
    fn parse_and_validate_event(payload: &str) -> Result<(OrderDeliveredEvent, DeliveryAction), DeliveryAction> {
        // Parse JSON
        let event: OrderDeliveredEvent = match serde_json::from_str(payload) {
            Ok(e) => e,
            Err(_) => return Err(DeliveryAction::Nack), // Malformed JSON
        };
        
        // Validate UUIDs
        if uuid::Uuid::parse_str(&event.order_id).is_err() {
            return Err(DeliveryAction::Nack);
        }
        if uuid::Uuid::parse_str(&event.user_id).is_err() {
            return Err(DeliveryAction::Nack);
        }
        if uuid::Uuid::parse_str(&event.repartidor_id).is_err() {
            return Err(DeliveryAction::Nack);
        }
        if uuid::Uuid::parse_str(&event.restaurante_id).is_err() {
            return Err(DeliveryAction::Nack);
        }
        
        // Validate delivered_at as RFC3339
        if chrono::DateTime::parse_from_rfc3339(&event.delivered_at).is_err() {
            return Err(DeliveryAction::Nack);
        }
        
        Ok((event, DeliveryAction::Ack))
    }
    
    #[test]
    fn test_parse_valid_event() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "2024-05-04T12:00:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_ok());
        
        let (event, action) = result.unwrap();
        assert_eq!(event.event_type, "order.delivered");
        assert_eq!(event.order_id, "550e8400-e29b-41d4-a716-446655440000");
        matches!(action, DeliveryAction::Ack);
    }
    
    #[test]
    fn test_parse_malformed_json_nack() {
        let payload = r#"{"event_id": "evt-123", invalid json"#;
        
        let result = parse_and_validate_event(payload);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DeliveryAction::Nack));
    }
    
    #[test]
    fn test_parse_invalid_uuid_in_order_id_nack() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "not-a-uuid",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "2024-05-04T12:00:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_invalid_uuid_in_user_id_nack() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "invalid-uuid",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "2024-05-04T12:00:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_invalid_uuid_in_repartidor_id_nack() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "malformed",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "2024-05-04T12:00:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_invalid_uuid_in_restaurante_id_nack() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "bad-uuid",
            "delivered_at": "2024-05-04T12:00:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_invalid_datetime_nack() {
        let payload = json!({
            "event_id": "evt-123",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "not-a-date"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_ack_on_valid_event() {
        let payload = json!({
            "event_id": "evt-456",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "repartidor_id": "550e8400-e29b-41d4-a716-446655440002",
            "restaurante_id": "550e8400-e29b-41d4-a716-446655440003",
            "delivered_at": "2024-05-04T15:30:00Z"
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_ok());
        let (_, action) = result.unwrap();
        assert!(matches!(action, DeliveryAction::Ack));
    }
    
    #[test]
    fn test_nack_on_missing_field() {
        let payload = json!({
            "event_id": "evt-789",
            "event_type": "order.delivered",
            "order_id": "550e8400-e29b-41d4-a716-446655440000"
            // Missing user_id, repartidor_id, restaurante_id, delivered_at
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_no_crash_on_empty_string() {
        let payload = "";
        let result = parse_and_validate_event(payload);
        assert!(result.is_err());
        // Should not panic
    }
    
    #[test]
    fn test_no_crash_on_null_values() {
        let payload = json!({
            "event_id": null,
            "event_type": null,
            "order_id": null,
            "user_id": null,
            "repartidor_id": null,
            "restaurante_id": null,
            "delivered_at": null
        }).to_string();
        
        let result = parse_and_validate_event(&payload);
        assert!(result.is_err());
        // Should not panic
    }
}
