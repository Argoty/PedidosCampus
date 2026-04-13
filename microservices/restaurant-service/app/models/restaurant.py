from sqlalchemy import (
    Column,
    String,
    Text,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base


class Restaurante(Base):
    """Restaurant model."""

    __tablename__ = "restaurantes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(255), nullable=False, index=True)
    descripcion = Column(Text, nullable=True)
    direccion = Column(String(500), nullable=False)
    categoria = Column(String(100), nullable=False, index=True)
    imagen_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    productos = relationship(
        "Producto", back_populates="restaurante", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_categoria", "categoria"),
        Index("idx_is_active", "is_active"),
    )


class Producto(Base):
    """Product model."""

    __tablename__ = "productos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id = Column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio = Column(Numeric(10, 2), nullable=False)
    disponible = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    restaurante = relationship("Restaurante", back_populates="productos")

    __table_args__ = (
        Index("idx_restaurante_id", "restaurante_id"),
        Index("idx_disponible", "disponible"),
    )
