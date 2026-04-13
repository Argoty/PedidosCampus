from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.api.dependencies import require_admin_role
from app.services.restaurant_service import ProductoService
from app.schemas.restaurant import (
    ProductoCreate,
    ProductoUpdate,
    ProductoResponse,
    ProductoValidacionRequest,
    ProductoValidacionResponse,
)

router = APIRouter(tags=["Productos"])


@router.post(
    "/restaurants/{restaurante_id}/products",
    response_model=ProductoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_role)],
)
async def crear_producto(
    restaurante_id: UUID,
    producto_in: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Create new producto (admin only)."""
    producto = await ProductoService.crear_producto(db, restaurante_id, producto_in)

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurante not found",
        )

    return producto


@router.get("/restaurants/{restaurante_id}/products", response_model=dict)
async def listar_productos(
    restaurante_id: UUID,
    disponible: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List productos by restaurante."""
    productos, total = await ProductoService.listar_productos(
        db,
        restaurante_id,
        disponible=disponible,
        limit=limit,
        offset=offset,
    )

    return {
        "items": [ProductoResponse.model_validate(p) for p in productos],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/products/{producto_id}", response_model=ProductoResponse)
async def obtener_producto(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get producto by ID."""
    producto = await ProductoService.obtener_producto(db, producto_id)

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto not found",
        )

    return producto


@router.patch(
    "/products/{producto_id}",
    response_model=ProductoResponse,
    dependencies=[Depends(require_admin_role)],
)
async def actualizar_producto(
    producto_id: UUID,
    producto_in: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Update producto (admin only)."""
    producto = await ProductoService.actualizar_producto(db, producto_id, producto_in)

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto not found",
        )

    return producto


@router.delete(
    "/products/{producto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_role)],
)
async def eliminar_producto(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_role),
):
    """Delete (soft) producto (admin only)."""
    success = await ProductoService.eliminar_producto(db, producto_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto not found",
        )


@router.post(
    "/products/validate-batch",
    response_model=ProductoValidacionResponse,
    status_code=status.HTTP_200_OK,
)
async def validar_productos_batch(
    validacion_in: ProductoValidacionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate batch of productos (for order-service integration)."""
    result = await ProductoService.validar_productos_batch(db, validacion_in)
    return result
