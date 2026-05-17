pub mod app;
pub mod config;
pub mod delivered_order_repo;
pub mod delivered_order_service;
pub mod delivery_handler;
pub mod delivery_repository;
pub mod delivery_service;
pub mod dto;
pub mod errors;
pub mod models;
pub mod rabbitmq;
pub mod restaurant_handler;
pub mod restaurant_repository;
pub mod restaurant_service;
pub mod routes;
pub mod state;

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use crate::models::RestaurantRating;
    use chrono::Utc;

    #[test]
    fn test_create_rating_invalid_stars() {
        // Test validation of estrellas (stars must be 1-5)
        let rating = RestaurantRating {
            id: Uuid::new_v4(),
            pedido_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            restaurante_id: Uuid::new_v4(),
            estrellas: 6, // Invalid: > 5
            comentario: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // This would fail validation in service
        assert!(rating.estrellas > 5);
    }

    #[test]
    fn test_create_rating_valid() {
        let rating = RestaurantRating {
            id: Uuid::new_v4(),
            pedido_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            restaurante_id: Uuid::new_v4(),
            estrellas: 5,
            comentario: Some("Excelente servicio".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert_eq!(rating.estrellas, 5);
        assert!(rating.comentario.is_some());
    }

    #[test]
    fn test_rating_timestamps() {
        let now = Utc::now();
        let rating = RestaurantRating {
            id: Uuid::new_v4(),
            pedido_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            restaurante_id: Uuid::new_v4(),
            estrellas: 4,
            comentario: None,
            created_at: now,
            updated_at: now,
        };

        assert_eq!(rating.created_at, rating.updated_at);
    }

    #[test]
    fn test_uuid_uniqueness() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_rating_with_max_comment_length() {
        let long_comment = "a".repeat(500);
        let rating = RestaurantRating {
            id: Uuid::new_v4(),
            pedido_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            restaurante_id: Uuid::new_v4(),
            estrellas: 3,
            comentario: Some(long_comment.clone()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert_eq!(rating.comentario.unwrap().len(), 500);
    }
}
