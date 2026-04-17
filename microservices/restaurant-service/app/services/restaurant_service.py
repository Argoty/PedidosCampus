from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.repositories.restaurant_repository import (
    RestauranteRepository,
    ProductoRepository,
)
from app.schemas.restaurant import (
    RestauranteCreate,
    RestauranteUpdate,
    ProductoCreate,
    ProductoUpdate,
    ProductoValidacionRequest,
    ProductoValidacionResponse,
    ProductoValidacionResultItem,
)
from app.models.restaurant import Restaurante, Producto


class RestauranteService:
    """Business logic for Restaurante."""

    @staticmethod
    async def crear_restaurante(
        db: AsyncSession, restaurante_in: RestauranteCreate
    ) -> Restaurante:
        """Create new restaurante."""
        return await RestauranteRepository.create(db, restaurante_in)

    @staticmethod
    async def obtener_restaurante(
        db: AsyncSession, restaurante_id: UUID
    ) -> Optional[Restaurante]:
        """Get restaurante by ID."""
        return await RestauranteRepository.get_by_id(db, restaurante_id)

    @staticmethod
    async def listar_restaurantes(
        db: AsyncSession,
        categoria: Optional[str] = None,
        is_active: bool = True,
        q: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Restaurante], int]:
        """List restaurantes with filters."""
        return await RestauranteRepository.list(
            db,
            categoria=categoria,
            is_active=is_active,
            q=q,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def actualizar_restaurante(
        db: AsyncSession,
        restaurante_id: UUID,
        restaurante_in: RestauranteUpdate,
    ) -> Optional[Restaurante]:
        """Update restaurante."""
        restaurante = await RestauranteRepository.get_by_id(db, restaurante_id)
        if not restaurante:
            return None
        return await RestauranteRepository.update(db, restaurante, restaurante_in)

    @staticmethod
    async def activar_restaurante(
        db: AsyncSession, restaurante_id: UUID
    ) -> Optional[Restaurante]:
        """Activate restaurante."""
        return await RestauranteRepository.activate(db, restaurante_id)

    @staticmethod
    async def desactivar_restaurante(
        db: AsyncSession, restaurante_id: UUID
    ) -> Optional[Restaurante]:
        """Deactivate restaurante."""
        return await RestauranteRepository.deactivate(db, restaurante_id)


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
