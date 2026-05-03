from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.restaurante_repository import RestauranteRepository
from app.schemas.restaurant import (
    RestauranteCreate,
    RestauranteUpdate,
)
from app.models.restaurante import Restaurante


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
