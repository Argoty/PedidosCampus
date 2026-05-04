use std::sync::Arc;
use sqlx::PgPool;
use crate::{
    delivery_service::DeliveryRatingService,
    delivery_repository::DeliveryRatingRepository,
    restaurant_service::RestaurantRatingService,
    restaurant_repository::RestaurantRatingRepository,
    delivered_order_service::DeliveredOrderService,
};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub delivery_service: DeliveryRatingService,
    pub restaurant_service: RestaurantRatingService,
    pub delivered_order_service: Arc<DeliveredOrderService>,
}

impl AppState {
    pub fn new(db: PgPool, delivered_order_service: Arc<DeliveredOrderService>) -> Self {
        let delivery_repo = DeliveryRatingRepository::new(db.clone());
        let restaurant_repo = RestaurantRatingRepository::new(db.clone());

        Self {
            db,
            delivery_service: DeliveryRatingService::new(delivery_repo, delivered_order_service.clone()),
            restaurant_service: RestaurantRatingService::new(restaurant_repo, delivered_order_service.clone()),
            delivered_order_service,
        }
    }
}
