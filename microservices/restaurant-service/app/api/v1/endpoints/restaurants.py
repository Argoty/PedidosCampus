from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.api.dependencies import require_admin_role, require_auth
from app.services.restaurant_service import RestauranteService
from app.schemas.restaurant import (
    RestauranteCreate,
    RestauranteUpdate,
    RestauranteResponse,
    RestauranteLista,
    RestauranteDetalle,
)

router = APIRouter(prefix="/restaurants", tags=["Restaurantes"])


@router.post(
    "",
    response_model=RestauranteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_role)],
)
async def crear_restaurante(
    restaurante_in: RestauranteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Create new restaurante (admin only)."""
    restaurante = await RestauranteService.crear_restaurante(db, restaurante_in)
    return restaurante


@router.get("", response_model=dict)
async def listar_restaurantes(
    categoria: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    q: Optional[str] = Query(None, description="Search by name or description"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List restaurantes (public, with filters)."""
    restaurantes, total = await RestauranteService.listar_restaurantes(
        db,
        categoria=categoria,
        is_active=is_active,
        q=q,
        limit=limit,
        offset=offset,
    )

    return {
        "items": [RestauranteLista.model_validate(r) for r in restaurantes],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{restaurante_id}", response_model=RestauranteDetalle)
async def obtener_restaurante(
    restaurante_id: UUID,
    include_unavailable: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Get restaurante by ID (with menu)."""
    restaurante = await RestauranteService.obtener_restaurante(db, restaurante_id)

    if not restaurante:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurante not found",
        )

    # Filter productos if needed
    if not include_unavailable:
        restaurante.productos = [p for p in restaurante.productos if p.disponible]

    return restaurante


@router.patch(
    "/{restaurante_id}",
    response_model=RestauranteResponse,
    dependencies=[Depends(require_admin_role)],
)
async def actualizar_restaurante(
    restaurante_id: UUID,
    restaurante_in: RestauranteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Update restaurante (admin only)."""
    restaurante = await RestauranteService.actualizar_restaurante(
        db, restaurante_id, restaurante_in
    )

    if not restaurante:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurante not found",
        )

    return restaurante


@router.post(
    "/{restaurante_id}/activate",
    response_model=RestauranteResponse,
    dependencies=[Depends(require_admin_role)],
)
async def activar_restaurante(
    restaurante_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Activate restaurante (admin only)."""
    restaurante = await RestauranteService.activar_restaurante(db, restaurante_id)

    if not restaurante:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurante not found",
        )

    return restaurante


@router.post(
    "/{restaurante_id}/deactivate",
    response_model=RestauranteResponse,
    dependencies=[Depends(require_admin_role)],
)
async def desactivar_restaurante(
    restaurante_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Deactivate restaurante (admin only)."""
    restaurante = await RestauranteService.desactivar_restaurante(db, restaurante_id)

    if not restaurante:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurante not found",
        )

    return restaurante
