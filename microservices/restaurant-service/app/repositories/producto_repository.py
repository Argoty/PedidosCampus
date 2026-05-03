from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.producto import Producto
from app.schemas.restaurant import (
    ProductoCreate,
    ProductoUpdate,
)


class ProductoRepository:
    """Repository for Producto operations."""

    @staticmethod
    async def create(
        db: AsyncSession, restaurante_id: UUID, producto_in: ProductoCreate
    ) -> Producto:
        """Create a new producto."""
        db_producto = Producto(
            restaurante_id=restaurante_id, **producto_in.model_dump()
        )
        db.add(db_producto)
        await db.flush()
        await db.refresh(db_producto)
        return db_producto

    @staticmethod
    async def get_by_id(db: AsyncSession, producto_id: UUID) -> Optional[Producto]:
        """Get producto by ID."""
        result = await db.execute(select(Producto).where(Producto.id == producto_id))
        return result.scalars().first()

    @staticmethod
    async def get_by_ids(db: AsyncSession, producto_ids: list[UUID]) -> List[Producto]:
        """Get multiple productos by IDs."""
        result = await db.execute(select(Producto).where(Producto.id.in_(producto_ids)))
        return result.scalars().all()

    @staticmethod
    async def list_by_restaurante(
        db: AsyncSession,
        restaurante_id: UUID,
        disponible: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Producto], int]:
        """List productos by restaurante."""
        query = select(Producto).where(Producto.restaurante_id == restaurante_id)

        if disponible is not None:
            query = query.where(Producto.disponible == disponible)

        # Get total count
        count_result = await db.execute(
            select(func.count(Producto.id)).select_from(
                select(Producto)
                .where(
                    (Producto.restaurante_id == restaurante_id)
                    and (
                        Producto.disponible == disponible
                        if disponible is not None
                        else True
                    )
                )
                .subquery()
            )
        )
        total = count_result.scalar() or 0

        # Execute query with pagination
        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        productos = result.scalars().all()

        return productos, total

    @staticmethod
    async def update(
        db: AsyncSession, db_producto: Producto, producto_in: ProductoUpdate
    ) -> Producto:
        """Update producto."""
        update_data = producto_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_producto, field, value)

        await db.flush()
        await db.refresh(db_producto)
        return db_producto

    @staticmethod
    async def delete(db: AsyncSession, producto_id: UUID) -> bool:
        """Soft delete producto (set disponible=False)."""
        producto = await ProductoRepository.get_by_id(db, producto_id)
        if producto:
            producto.disponible = False
            await db.flush()
            return True
        return False
