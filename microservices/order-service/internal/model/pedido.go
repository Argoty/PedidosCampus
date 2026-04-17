package model

import (
	"database/sql/driver"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EstadoPedido enum values
type EstadoPedido string

const (
	EstadoPendiente EstadoPedido = "pendiente"
	EstadoAceptado  EstadoPedido = "aceptado"
	EstadoEnCamino  EstadoPedido = "en_camino"
	EstadoEntregado EstadoPedido = "entregado"
	EstadoCancelado EstadoPedido = "cancelado"
)

// Scan implements the sql.Scanner interface
func (e *EstadoPedido) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	// Handle string
	if strVal, ok := value.(string); ok {
		*e = EstadoPedido(strVal)
		return nil
	}

	// Handle []byte
	if bytes, ok := value.([]byte); ok {
		*e = EstadoPedido(bytes)
		return nil
	}

	return errors.New("type assertion failed")
}

// Value implements the driver.Valuer interface
func (e EstadoPedido) Value() (driver.Value, error) {
	return string(e), nil
}

// Pedido represents an order in the system
type Pedido struct {
	ID               uuid.UUID         `gorm:"type:uuid;primaryKey" json:"id"`
	UserID           uuid.UUID         `gorm:"type:uuid;index" json:"userId"`
	RestauranteID    uuid.UUID         `gorm:"type:uuid;index" json:"restauranteId"`
	RepartidorID     *uuid.UUID        `gorm:"type:uuid;index" json:"repartidorId,omitempty"`
	Estado           EstadoPedido      `gorm:"type:varchar(20);index;default:'pendiente'" json:"estado"`
	Subtotal         float64           `gorm:"type:decimal(10,2)" json:"subtotal"`
	CostoEntrega     float64           `gorm:"type:decimal(10,2);default:0" json:"costoEntrega"`
	Total            float64           `gorm:"type:decimal(10,2)" json:"total"`
	DireccionEntrega string            `gorm:"type:varchar(200)" json:"direccionEntrega"`
	CancelledAt      *time.Time        `gorm:"type:timestamp" json:"cancelledAt,omitempty"`
	CreatedAt        time.Time         `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt        time.Time         `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	Items            []PedidoItem      `gorm:"foreignKey:PedidoID;constraint:OnDelete:Cascade" json:"items"`
	Historial        []PedidoEstadoLog `gorm:"foreignKey:PedidoID;constraint:OnDelete:Cascade" json:"historial"`
}

// TableName specifies the table name
func (Pedido) TableName() string {
	return "pedidos"
}

// BeforeCreate generates UUID if not set
func (p *Pedido) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// PedidoItem represents a line item in an order
type PedidoItem struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	PedidoID   uuid.UUID `gorm:"type:uuid;index" json:"pedidoId"`
	ProductID  uuid.UUID `gorm:"type:uuid;index" json:"productId"`
	Nombre     string    `gorm:"type:varchar(255)" json:"nombre"`
	PrecioUnit float64   `gorm:"type:decimal(10,2)" json:"precioUnit"`
	Cantidad   int       `gorm:"type:int" json:"cantidad"`
	Subtotal   float64   `gorm:"type:decimal(10,2)" json:"subtotal"`
	CreatedAt  time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	Pedido     Pedido    `gorm:"foreignKey:PedidoID" json:"-"`
}

// TableName specifies the table name
func (PedidoItem) TableName() string {
	return "pedido_items"
}

// BeforeCreate generates UUID if not set
func (p *PedidoItem) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// PedidoEstadoLog tracks state transitions
type PedidoEstadoLog struct {
	ID         uuid.UUID     `gorm:"type:uuid;primaryKey" json:"id"`
	PedidoID   uuid.UUID     `gorm:"type:uuid;index" json:"pedidoId"`
	FromEstado *EstadoPedido `gorm:"type:varchar(20)" json:"fromEstado"`
	ToEstado   EstadoPedido  `gorm:"type:varchar(20);index" json:"toEstado"`
	ChangedBy  *uuid.UUID    `gorm:"type:uuid" json:"changedBy"`
	CreatedAt  time.Time     `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	Pedido     Pedido        `gorm:"foreignKey:PedidoID" json:"-"`
}

// TableName specifies the table name
func (PedidoEstadoLog) TableName() string {
	return "pedido_estado_logs"
}

// BeforeCreate generates UUID if not set
func (p *PedidoEstadoLog) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// Helper methods for validation

// IsValidTransition checks if estado transition is allowed
func (p *Pedido) IsValidTransition(toEstado EstadoPedido) bool {
	switch p.Estado {
	case EstadoPendiente:
		return toEstado == EstadoAceptado || toEstado == EstadoCancelado
	case EstadoAceptado:
		return toEstado == EstadoEnCamino || toEstado == EstadoCancelado
	case EstadoEnCamino:
		return toEstado == EstadoEntregado
	case EstadoEntregado, EstadoCancelado:
		return false
	}
	return false
}

// IsCancellable checks if order can be cancelled
func (p *Pedido) IsCancellable() bool {
	return p.Estado == EstadoPendiente
}
