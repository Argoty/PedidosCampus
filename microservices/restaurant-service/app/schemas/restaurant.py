from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal
from uuid import UUID


class RestauranteBase(BaseModel):
    """Base schema for Restaurante."""

    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=1000)
    direccion: str = Field(..., min_length=1, max_length=500)
    categoria: str = Field(..., min_length=1, max_length=100)
    imagen_url: Optional[str] = Field(None, max_length=500)


class RestauranteCreate(RestauranteBase):
    """Schema for creating Restaurante."""

    pass


class RestauranteUpdate(BaseModel):
    """Schema for updating Restaurante."""

    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=1000)
    direccion: Optional[str] = Field(None, min_length=1, max_length=500)
    categoria: Optional[str] = Field(None, min_length=1, max_length=100)
    imagen_url: Optional[str] = Field(None, max_length=500)


class RestauranteResponse(RestauranteBase):
    """Schema for Restaurante response."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RestauranteLista(BaseModel):
    """Schema for Restaurante list item (resumido)."""

    id: UUID
    nombre: str
    categoria: str
    imagen_url: Optional[str]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RestauranteDetalle(RestauranteResponse):
    """Schema for Restaurante detail with products."""

    productos: list["ProductoResponse"] = []

    model_config = ConfigDict(from_attributes=True)


# ============ PRODUCTO SCHEMAS ============


class ProductoBase(BaseModel):
    """Base schema for Producto."""

    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=1000)
    precio: Decimal = Field(..., gt=0, decimal_places=2)
    disponible: bool = True


class ProductoCreate(ProductoBase):
    """Schema for creating Producto."""

    pass


class ProductoUpdate(BaseModel):
    """Schema for updating Producto."""

    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=1000)
    precio: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    disponible: Optional[bool] = None


class ProductoResponse(ProductoBase):
    """Schema for Producto response."""

    id: UUID
    restaurante_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ BATCH VALIDATION ============


class ProductoValidacionItem(BaseModel):
    """Item for batch product validation."""

    producto_id: UUID
    precio_unit: Decimal = Field(..., gt=0, decimal_places=2)


class ProductoValidacionRequest(BaseModel):
    """Request for batch product validation."""

    items: list[ProductoValidacionItem]


class ProductoValidacionResultItem(BaseModel):
    """Result item for batch validation."""

    producto_id: UUID
    ok: bool
    servidor_precio: Optional[Decimal] = None
    nombre: Optional[str] = None
    disponible: Optional[bool] = None
    error: Optional[str] = None


class ProductoValidacionResponse(BaseModel):
    """Response for batch product validation."""

    items: list[ProductoValidacionResultItem]
