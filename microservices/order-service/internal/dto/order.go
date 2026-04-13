package dto

import (
	"time"

	"github.com/google/uuid"
)

// CreateOrderRequest represents the request to create an order
type CreateOrderRequest struct {
	RestauranteID    uuid.UUID         `json:"restauranteId" binding:"required"`
	DireccionEntrega string            `json:"direccionEntrega" binding:"required,min=5,max=200"`
	Items            []CreateOrderItem `json:"items" binding:"required,min=1,max=100"`
}

// CreateOrderItem represents an item in the order
type CreateOrderItem struct {
	ProductID  uuid.UUID `json:"productId" binding:"required"`
	Nombre     string    `json:"nombre" binding:"required"`
	PrecioUnit float64   `json:"precioUnit" binding:"required,min=0"`
	Cantidad   int       `json:"cantidad" binding:"required,min=1,max=999"`
}

// AcceptOrderRequest represents the request to accept an order
type AcceptOrderRequest struct {
	RepartidorID uuid.UUID `json:"repartidorId" binding:"required"`
}

// UpdateOrderStatusRequest represents the request to update order status
type UpdateOrderStatusRequest struct {
	ToEstado       string `json:"toEstado" binding:"required,oneof=pendiente aceptado en_camino entregado cancelado"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// CancelOrderRequest represents the request to cancel an order
type CancelOrderRequest struct {
	Reason string `json:"reason"`
}

// OrderResponse represents the response for an order
type OrderResponse struct {
	ID               uuid.UUID              `json:"id"`
	UserID           uuid.UUID              `json:"userId"`
	RestauranteID    uuid.UUID              `json:"restauranteId"`
	RepartidorID     *uuid.UUID             `json:"repartidorId,omitempty"`
	Estado           string                 `json:"estado"`
	Subtotal         float64                `json:"subtotal"`
	CostoEntrega     float64                `json:"costoEntrega"`
	Total            float64                `json:"total"`
	DireccionEntrega string                 `json:"direccionEntrega"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
	Items            []OrderItemResponse    `json:"items,omitempty"`
	Historial        []OrderHistoryResponse `json:"historial,omitempty"`
}

// OrderItemResponse represents an order item response
type OrderItemResponse struct {
	ID         uuid.UUID `json:"id"`
	ProductID  uuid.UUID `json:"productId"`
	Nombre     string    `json:"nombre"`
	PrecioUnit float64   `json:"precioUnit"`
	Cantidad   int       `json:"cantidad"`
	Subtotal   float64   `json:"subtotal"`
}

// OrderHistoryResponse represents the state change history
type OrderHistoryResponse struct {
	ID         uuid.UUID  `json:"id"`
	FromEstado *string    `json:"fromEstado"`
	ToEstado   string     `json:"toEstado"`
	ChangedBy  *uuid.UUID `json:"changedBy"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Data       interface{}        `json:"data"`
	Pagination PaginationMetadata `json:"pagination"`
}

// PaginationMetadata holds pagination metadata
type PaginationMetadata struct {
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
	Total  int64 `json:"total"`
}

// ListOrdersQuery represents query parameters for listing orders
type ListOrdersQuery struct {
	Limit         int    `form:"limit,default=10"`
	Offset        int    `form:"offset,default=0"`
	Estado        string `form:"estado"`
	RestauranteID string `form:"restauranteId"`
	UserID        string `form:"userId"`
}
