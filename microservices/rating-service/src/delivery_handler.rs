use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use crate::{
    dto::{CreateRatingRequest, UpdateRatingRequest, RatingResponse, ListRatingsResponse, PaginationInfo, StatsInfo, DistributionInfo},
    errors::Result,
    models::DeliveryRating,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

/// Crear una nueva calificación para un repartidor
#[utoipa::path(
    post,
    path = "/ratings/delivery",
    request_body = CreateRatingRequest,
    responses(
        (status = 201, description = "Rating creado exitosamente", body = RatingResponse),
        (status = 400, description = "Datos inválidos"),
        (status = 409, description = "Calificación duplicada para este pedido")
    )
)]
pub async fn create_delivery_rating(
    State(state): State<AppState>,
    Json(payload): Json<CreateRatingRequest>,
) -> Result<(StatusCode, Json<RatingResponse>)> {
    let repartidor_id = payload.repartidor_id.ok_or_else(|| crate::errors::AppError::ValidationError("repartidor_id required".to_string()))?;
    
    // Extract user_id from JWT (mock for now)
    let user_id = Uuid::new_v4();

    let rating = state.delivery_service
        .create(payload.pedido_id, repartidor_id, user_id, payload.estrellas, payload.comentario)
        .await?;

    Ok((StatusCode::CREATED, Json(rating_to_response(&rating, None, Some(repartidor_id)))))
}

/// Obtener una calificación de repartidor por ID
#[utoipa::path(
    get,
    path = "/ratings/delivery/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    responses(
        (status = 200, description = "Rating obtenido", body = RatingResponse),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn get_delivery_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RatingResponse>> {
    let rating = state.delivery_service.get_by_id(id).await?;

    Ok(Json(rating_to_response(&rating, None, Some(rating.repartidor_id))))
}

/// Listar calificaciones de un usuario
#[utoipa::path(
    get,
    path = "/ratings/delivery/user/{userId}",
    params(
        ("userId" = Uuid, Path, description = "ID del usuario"),
        ("limit" = Option<i64>, Query, description = "Límite de resultados"),
        ("offset" = Option<i64>, Query, description = "Desplazamiento")
    ),
    responses(
        (status = 200, description = "Lista de ratings del usuario", body = ListRatingsResponse)
    )
)]
pub async fn get_user_delivery_ratings(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListRatingsResponse>> {
    let limit = q.limit.unwrap_or(10);
    let offset = q.offset.unwrap_or(0);

    let (ratings, total) = state.delivery_service.get_by_user(user_id, limit, offset).await?;

    let data = ratings
        .iter()
        .map(|r| rating_to_response(r, None, Some(r.repartidor_id)))
        .collect();

    Ok(Json(ListRatingsResponse {
        data,
        pagination: PaginationInfo { total, limit, offset },
        stats: None,
    }))
}

/// Listar calificaciones de un repartidor con estadísticas
#[utoipa::path(
    get,
    path = "/ratings/delivery/delivery/{repartidorId}",
    params(
        ("repartidorId" = Uuid, Path, description = "ID del repartidor"),
        ("limit" = Option<i64>, Query, description = "Límite de resultados"),
        ("offset" = Option<i64>, Query, description = "Desplazamiento")
    ),
    responses(
        (status = 200, description = "Lista de ratings con stats", body = ListRatingsResponse)
    )
)]
pub async fn get_delivery_ratings(
    State(state): State<AppState>,
    Path(repartidor_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListRatingsResponse>> {
    let limit = q.limit.unwrap_or(10);
    let offset = q.offset.unwrap_or(0);

    let (ratings, total) = state.delivery_service.get_by_delivery(repartidor_id, limit, offset).await?;
    let (avg_rating, total_count, dist) = state.delivery_service.get_stats(repartidor_id).await?;

    let data = ratings
        .iter()
        .map(|r| rating_to_response(r, None, Some(r.repartidor_id)))
        .collect();

    Ok(Json(ListRatingsResponse {
        data,
        pagination: PaginationInfo { total, limit, offset },
        stats: Some(StatsInfo {
            average_rating: avg_rating,
            total_ratings: total_count,
            distribution: DistributionInfo {
                stars_5: dist.0,
                stars_4: dist.1,
                stars_3: dist.2,
                stars_2: dist.3,
                stars_1: dist.4,
            },
        }),
    }))
}

/// Actualizar una calificación de repartidor
#[utoipa::path(
    patch,
    path = "/ratings/delivery/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    request_body = UpdateRatingRequest,
    responses(
        (status = 200, description = "Rating actualizado", body = RatingResponse),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn update_delivery_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRatingRequest>,
) -> Result<Json<RatingResponse>> {
    let rating = state.delivery_service.update(id, payload.estrellas, payload.comentario).await?;

    Ok(Json(rating_to_response(&rating, None, Some(rating.repartidor_id))))
}

/// Eliminar una calificación de repartidor
#[utoipa::path(
    delete,
    path = "/ratings/delivery/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    responses(
        (status = 204, description = "Rating eliminado"),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn delete_delivery_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    state.delivery_service.delete(id).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Obtener estadísticas de calificaciones de un repartidor
#[utoipa::path(
    get,
    path = "/ratings/stats/delivery/{repartidorId}",
    params(
        ("repartidorId" = Uuid, Path, description = "ID del repartidor")
    ),
    responses(
        (status = 200, description = "Estadísticas del repartidor", body = StatsInfo)
    )
)]
pub async fn get_delivery_stats(
    State(state): State<AppState>,
    Path(repartidor_id): Path<Uuid>,
) -> Result<Json<StatsInfo>> {
    let (avg_rating, total_count, dist) = state.delivery_service.get_stats(repartidor_id).await?;

    Ok(Json(StatsInfo {
        average_rating: avg_rating,
        total_ratings: total_count,
        distribution: DistributionInfo {
            stars_5: dist.0,
            stars_4: dist.1,
            stars_3: dist.2,
            stars_2: dist.3,
            stars_1: dist.4,
        },
    }))
}

fn rating_to_response(rating: &DeliveryRating, restaurante_id: Option<Uuid>, repartidor_id: Option<Uuid>) -> RatingResponse {
    RatingResponse {
        id: rating.id,
        pedido_id: rating.pedido_id,
        user_id: rating.user_id,
        restaurante_id,
        repartidor_id,
        estrellas: rating.estrellas,
        comentario: rating.comentario.clone(),
        created_at: rating.created_at.to_rfc3339(),
        updated_at: rating.updated_at.to_rfc3339(),
    }
}
