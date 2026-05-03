from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurante import Restaurante
from app.schemas.restaurant import (
    RestauranteCreate,
    RestauranteUpdate,
)


class RestauranteRepository:
    """Repository for Restaurante operations."""

    @staticmethod
    async def create(
        db: AsyncSession, restaurante_in: RestauranteCreate
    ) -> Restaurante:
        """Create a new restaurante."""
        db_restaurante = Restaurante(**restaurante_in.model_dump())
        db.add(db_restaurante)
        await db.flush()
        await db.refresh(db_restaurante)
        return db_restaurante

    @staticmethod
    async def get_by_id(
        db: AsyncSession, restaurante_id: UUID
    ) -> Optional[Restaurante]:
        """Get restaurante by ID with productos."""
        result = await db.execute(
            select(Restaurante)
            .where(Restaurante.id == restaurante_id)
            .options(selectinload(Restaurante.productos))
        )
        return result.scalars().first()

    @staticmethod
    async def list(
        db: AsyncSession,
        categoria: Optional[str] = None,
        is_active: Optional[bool] = True,
        q: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Restaurante], int]:
        """List restaurantes with filters."""
        query = select(Restaurante)

        if is_active is not None:
            query = query.where(Restaurante.is_active == is_active)

        if categoria:
            query = query.where(Restaurante.categoria == categoria)

        if q:
            query = query.where(
                (Restaurante.nombre.ilike(f"%{q}%"))
                | (Restaurante.descripcion.ilike(f"%{q}%"))
            )

        # Get total count
        count_result = await db.execute(
            select(func.count(Restaurante.id)).select_from(
                select(Restaurante)
                .where(
                    (
                        Restaurante.is_active == is_active
                        if is_active is not None
                        else True
                    )
                    and (Restaurante.categoria == categoria if categoria else True)
                    and (
                        (Restaurante.nombre.ilike(f"%{q}%"))
                        | (Restaurante.descripcion.ilike(f"%{q}%"))
                        if q
                        else True
                    )
                )
                .select_from(Restaurante)
                .subquery()
            )
        )
        total = count_result.scalar() or 0

        # Execute query with pagination
        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        restaurantes = result.scalars().all()

        return restaurantes, total

    @staticmethod
    async def update(
        db: AsyncSession, db_restaurante: Restaurante, restaurante_in: RestauranteUpdate
    ) -> Restaurante:
        """Update restaurante."""
        update_data = restaurante_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_restaurante, field, value)

        await db.flush()
        await db.refresh(db_restaurante)
        return db_restaurante

    @staticmethod
    async def activate(db: AsyncSession, restaurante_id: UUID) -> Optional[Restaurante]:
        """Activate restaurante."""
        restaurante = await RestauranteRepository.get_by_id(db, restaurante_id)
        if restaurante:
            restaurante.is_active = True
            await db.flush()
            await db.refresh(restaurante)
        return restaurante

    @staticmethod
    async def deactivate(
        db: AsyncSession, restaurante_id: UUID
    ) -> Optional[Restaurante]:
        """Deactivate restaurante."""
        restaurante = await RestauranteRepository.get_by_id(db, restaurante_id)
        if restaurante:
            restaurante.is_active = False
            await db.flush()
            await db.refresh(restaurante)
        return restaurante
