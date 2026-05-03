use sqlx::PgPool;
use crate::{
    delivery_service::DeliveryRatingService,
    delivery_repository::DeliveryRatingRepository,
    restaurant_service::RestaurantRatingService,
    restaurant_repository::RestaurantRatingRepository,
};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub delivery_service: DeliveryRatingService,
    pub restaurant_service: RestaurantRatingService,
}

impl AppState {
    pub fn new(db: PgPool) -> Self {
        let delivery_repo = DeliveryRatingRepository::new(db.clone());
        let restaurant_repo = RestaurantRatingRepository::new(db.clone());

        Self {
            db,
            delivery_service: DeliveryRatingService::new(delivery_repo),
            restaurant_service: RestaurantRatingService::new(restaurant_repo),
        }
    }
}
