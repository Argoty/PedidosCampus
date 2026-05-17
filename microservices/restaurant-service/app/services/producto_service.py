from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.repositories.restaurante_repository import RestauranteRepository
from app.repositories.producto_repository import ProductoRepository
from app.schemas.restaurant import (
    ProductoCreate,
    ProductoUpdate,
    ProductoValidacionRequest,
    ProductoValidacionResponse,
    ProductoValidacionResultItem,
)
from app.models.producto import Producto


class ProductoService:
    """Business logic for Producto."""

    @staticmethod
    async def crear_producto(
        db: AsyncSession,
        restaurante_id: UUID,
        producto_in: ProductoCreate,
    ) -> Optional[Producto]:
        """Create new producto."""
        # Validate restaurante exists
        restaurante = await RestauranteRepository.get_by_id(db, restaurante_id)
        if not restaurante:
            return None

        return await ProductoRepository.create(db, restaurante_id, producto_in)

    @staticmethod
    async def obtener_producto(
        db: AsyncSession, producto_id: UUID
    ) -> Optional[Producto]:
        """Get producto by ID."""
        return await ProductoRepository.get_by_id(db, producto_id)

    @staticmethod
    async def listar_productos(
        db: AsyncSession,
        restaurante_id: UUID,
        disponible: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Producto], int]:
        """List productos by restaurante."""
        return await ProductoRepository.list_by_restaurante(
            db,
            restaurante_id,
            disponible=disponible,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def actualizar_producto(
        db: AsyncSession,
        producto_id: UUID,
        producto_in: ProductoUpdate,
    ) -> Optional[Producto]:
        """Update producto."""
        producto = await ProductoRepository.get_by_id(db, producto_id)
        if not producto:
            return None
        return await ProductoRepository.update(db, producto, producto_in)

    @staticmethod
    async def eliminar_producto(db: AsyncSession, producto_id: UUID) -> bool:
        """Delete (soft) producto."""
        return await ProductoRepository.delete(db, producto_id)

    @staticmethod
    async def validar_productos_batch(
        db: AsyncSession,
        validacion_in: ProductoValidacionRequest,
    ) -> ProductoValidacionResponse:
        """Validate batch of productos for order service."""
        items_request = {item.producto_id for item in validacion_in.items}
        productos = await ProductoRepository.get_by_ids(db, list(items_request))

        productos_dict = {p.id: p for p in productos}

        result_items = []
        for item in validacion_in.items:
            producto = productos_dict.get(item.producto_id)

            if not producto:
                result_items.append(
                    ProductoValidacionResultItem(
                        producto_id=item.producto_id,
                        ok=False,
                        error="Producto no encontrado",
                    )
                )
            elif not producto.disponible:
                result_items.append(
                    ProductoValidacionResultItem(
                        producto_id=item.producto_id,
                        ok=False,
                        error="Producto no disponible",
                        servidor_precio=Decimal(producto.precio),
                        nombre=producto.nombre,
                        disponible=False,
                    )
                )
            elif item.precio_unit != Decimal(str(producto.precio)):
                result_items.append(
                    ProductoValidacionResultItem(
                        producto_id=item.producto_id,
                        ok=False,
                        error="Precio no coincide",
                        servidor_precio=Decimal(producto.precio),
                        nombre=producto.nombre,
                        disponible=True,
                    )
                )
            else:
                result_items.append(
                    ProductoValidacionResultItem(
                        producto_id=item.producto_id,
                        ok=True,
                        servidor_precio=Decimal(producto.precio),
                        nombre=producto.nombre,
                        disponible=True,
                    )
                )

        return ProductoValidacionResponse(items=result_items)
