use sqlx::PgPool;
use uuid::Uuid;
use crate::errors::{AppError, Result};
use crate::models::DeliveryRating;

pub struct DeliveryRatingRepository {
    pool: PgPool,
}

impl DeliveryRatingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, rating: &DeliveryRating) -> Result<DeliveryRating> {
        let result = sqlx::query_as::<_, DeliveryRating>(
            r#"
            INSERT INTO calificaciones_repartidor 
            (id, pedido_id, user_id, repartidor_id, estrellas, comentario, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(rating.id)
        .bind(rating.pedido_id)
        .bind(rating.user_id)
        .bind(rating.repartidor_id)
        .bind(rating.estrellas)
        .bind(&rating.comentario)
        .bind(rating.created_at)
        .bind(rating.updated_at)
        .fetch_one(&self.pool)
        .await;

        match result {
            Ok(r) => Ok(r),
            Err(sqlx::Error::Database(db_err)) => {
                if db_err.message().contains("unique constraint") {
                    Err(AppError::DuplicateRating)
                } else {
                    Err(AppError::DatabaseError(db_err.message().to_string()))
                }
            }
            Err(e) => Err(AppError::DatabaseError(e.to_string())),
        }
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<DeliveryRating> {
        sqlx::query_as::<_, DeliveryRating>(
            "SELECT * FROM calificaciones_repartidor WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .ok_or(AppError::NotFound)
    }

    pub async fn get_by_user(&self, user_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<DeliveryRating>, i64)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM calificaciones_repartidor WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let ratings = sqlx::query_as::<_, DeliveryRating>(
            "SELECT * FROM calificaciones_repartidor WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok((ratings, total.0))
    }

    pub async fn get_by_delivery(&self, repartidor_id: Uuid, limit: i64, offset: i64) -> Result<(Vec<DeliveryRating>, i64)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1")
            .bind(repartidor_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let ratings = sqlx::query_as::<_, DeliveryRating>(
            "SELECT * FROM calificaciones_repartidor WHERE repartidor_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(repartidor_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok((ratings, total.0))
    }

    pub async fn update(&self, id: Uuid, estrellas: Option<i32>, comentario: Option<String>) -> Result<DeliveryRating> {
        let existing = self.get_by_id(id).await?;

        let new_estrellas = estrellas.unwrap_or(existing.estrellas);
        let new_comentario = comentario.or(existing.comentario);

        sqlx::query_as::<_, DeliveryRating>(
            r#"
            UPDATE calificaciones_repartidor 
            SET estrellas = $1, comentario = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(new_estrellas)
        .bind(&new_comentario)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM calificaciones_repartidor WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if result.rows_affected() == 0 {
            Err(AppError::NotFound)
        } else {
            Ok(())
        }
    }

    pub async fn get_stats(&self, repartidor_id: Uuid) -> Result<(f64, i64, (i64, i64, i64, i64, i64))> {
        let stats: (Option<f64>, i64) = sqlx::query_as(
            "SELECT COALESCE(AVG(estrellas)::float8, 0.0), COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1"
        )
        .bind(repartidor_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let distribution: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COALESCE((SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1 AND estrellas = 5), 0),
                COALESCE((SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1 AND estrellas = 4), 0),
                COALESCE((SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1 AND estrellas = 3), 0),
                COALESCE((SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1 AND estrellas = 2), 0),
                COALESCE((SELECT COUNT(*) FROM calificaciones_repartidor WHERE repartidor_id = $1 AND estrellas = 1), 0)
            "#
        )
        .bind(repartidor_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok((stats.0.unwrap_or(0.0), stats.1, distribution))
    }
}
