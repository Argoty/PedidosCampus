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
    models::RestaurantRating,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

/// Crear una nueva calificación para un restaurante
#[utoipa::path(
    post,
    path = "/ratings/restaurant",
    request_body = CreateRatingRequest,
    responses(
        (status = 201, description = "Rating creado exitosamente", body = RatingResponse),
        (status = 400, description = "Datos inválidos"),
        (status = 409, description = "Calificación duplicada para este pedido")
    )
)]
pub async fn create_restaurant_rating(
    State(state): State<AppState>,
    Json(payload): Json<CreateRatingRequest>,
) -> Result<(StatusCode, Json<RatingResponse>)> {
    let restaurante_id = payload.restaurante_id.ok_or_else(|| crate::errors::AppError::ValidationError("restaurante_id required".to_string()))?;
    
    // Extract user_id from JWT (mock for now)
    let user_id = Uuid::new_v4();

    let rating = state.restaurant_service
        .create(payload.pedido_id, restaurante_id, user_id, payload.estrellas, payload.comentario)
        .await?;

    Ok((StatusCode::CREATED, Json(rating_to_response(&rating, Some(restaurante_id), None))))
}

/// Obtener una calificación de restaurante por ID
#[utoipa::path(
    get,
    path = "/ratings/restaurant/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    responses(
        (status = 200, description = "Rating obtenido", body = RatingResponse),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn get_restaurant_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RatingResponse>> {
    let rating = state.restaurant_service.get_by_id(id).await?;

    Ok(Json(rating_to_response(&rating, Some(rating.restaurante_id), None)))
}

/// Listar calificaciones de un usuario
#[utoipa::path(
    get,
    path = "/ratings/restaurant/user/{userId}",
    params(
        ("userId" = Uuid, Path, description = "ID del usuario"),
        ("limit" = Option<i64>, Query, description = "Límite de resultados"),
        ("offset" = Option<i64>, Query, description = "Desplazamiento")
    ),
    responses(
        (status = 200, description = "Lista de ratings del usuario", body = ListRatingsResponse)
    )
)]
pub async fn get_user_restaurant_ratings(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListRatingsResponse>> {
    let limit = q.limit.unwrap_or(10);
    let offset = q.offset.unwrap_or(0);

    let (ratings, total) = state.restaurant_service.get_by_user(user_id, limit, offset).await?;

    let data = ratings
        .iter()
        .map(|r| rating_to_response(r, Some(r.restaurante_id), None))
        .collect();

    Ok(Json(ListRatingsResponse {
        data,
        pagination: PaginationInfo { total, limit, offset },
        stats: None,
    }))
}

/// Listar calificaciones de un restaurante con estadísticas
#[utoipa::path(
    get,
    path = "/ratings/restaurant/restaurant/{restauranteId}",
    params(
        ("restauranteId" = Uuid, Path, description = "ID del restaurante"),
        ("limit" = Option<i64>, Query, description = "Límite de resultados"),
        ("offset" = Option<i64>, Query, description = "Desplazamiento")
    ),
    responses(
        (status = 200, description = "Lista de ratings con stats", body = ListRatingsResponse)
    )
)]
pub async fn get_restaurant_ratings(
    State(state): State<AppState>,
    Path(restaurante_id): Path<Uuid>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListRatingsResponse>> {
    let limit = q.limit.unwrap_or(10);
    let offset = q.offset.unwrap_or(0);

    let (ratings, total) = state.restaurant_service.get_by_restaurant(restaurante_id, limit, offset).await?;
    let (avg_rating, total_count, dist) = state.restaurant_service.get_stats(restaurante_id).await?;

    let data = ratings
        .iter()
        .map(|r| rating_to_response(r, Some(r.restaurante_id), None))
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

/// Actualizar una calificación de restaurante
#[utoipa::path(
    patch,
    path = "/ratings/restaurant/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    request_body = UpdateRatingRequest,
    responses(
        (status = 200, description = "Rating actualizado", body = RatingResponse),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn update_restaurant_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRatingRequest>,
) -> Result<Json<RatingResponse>> {
    let rating = state.restaurant_service.update(id, payload.estrellas, payload.comentario).await?;

    Ok(Json(rating_to_response(&rating, Some(rating.restaurante_id), None)))
}

/// Eliminar una calificación de restaurante
#[utoipa::path(
    delete,
    path = "/ratings/restaurant/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la calificación")
    ),
    responses(
        (status = 204, description = "Rating eliminado"),
        (status = 404, description = "Rating no encontrado")
    )
)]
pub async fn delete_restaurant_rating(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    state.restaurant_service.delete(id).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Obtener estadísticas de calificaciones de un restaurante
#[utoipa::path(
    get,
    path = "/ratings/stats/restaurant/{restauranteId}",
    params(
        ("restauranteId" = Uuid, Path, description = "ID del restaurante")
    ),
    responses(
        (status = 200, description = "Estadísticas del restaurante", body = StatsInfo)
    )
)]
pub async fn get_restaurant_stats(
    State(state): State<AppState>,
    Path(restaurante_id): Path<Uuid>,
) -> Result<Json<StatsInfo>> {
    let (avg_rating, total_count, dist) = state.restaurant_service.get_stats(restaurante_id).await?;

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

fn rating_to_response(rating: &RestaurantRating, restaurante_id: Option<Uuid>, repartidor_id: Option<Uuid>) -> RatingResponse {
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
