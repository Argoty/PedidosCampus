use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use sqlx::Error as SqlxError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Not found")]
    NotFound,

    #[error("Duplicate rating for this order")]
    DuplicateRating,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("RabbitMQ error: {0}")]
    RabbitMQError(#[from] lapin::Error),

    #[error("SQLx error: {0}")]
    SqlxError(#[from] SqlxError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::DatabaseError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", msg),
            ),
            AppError::NotFound => (StatusCode::NOT_FOUND, "Resource not found".to_string()),
            AppError::DuplicateRating => (
                StatusCode::CONFLICT,
                "Duplicate rating for this order".to_string(),
            ),
            AppError::ValidationError(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            AppError::InternalError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal server error: {}", msg),
            ),
            AppError::RabbitMQError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("RabbitMQ error: {}", e),
            ),
            AppError::SqlxError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("SQLx error: {}", e),
            ),
        };

        let body = Json(json!({
            "error": error_message.to_lowercase().replace(' ', "_"),
            "message": error_message
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
