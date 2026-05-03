from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    Index,
    func,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid
from app.core.database import Base


def now_utc():
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


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
