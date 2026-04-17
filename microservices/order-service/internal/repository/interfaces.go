package repository

import (
	"context"

	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/google/uuid"
)

// OrderRepository defines methods for order persistence
type OrderRepository interface {
	// CreateOrder creates a new order with items and initial state log in a transaction
	CreateOrder(ctx context.Context, pedido *model.Pedido, items []model.PedidoItem, stateLog model.PedidoEstadoLog) (*model.Pedido, error)

	// GetOrderByID retrieves an order with all related data
	GetOrderByID(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error)

	// ListOrdersByUser retrieves orders for a specific user
	ListOrdersByUser(ctx context.Context, userID uuid.UUID, limit, offset int, estado, restauranteID string) ([]model.Pedido, int64, error)

	// ListOrders retrieves orders with optional filters (admin use-case)
	ListOrders(ctx context.Context, limit, offset int, estado, restauranteID, userID string) ([]model.Pedido, int64, error)

	// ListActiveOrders retrieves all active orders (not entregado or cancelado)
	ListActiveOrders(ctx context.Context, limit, offset int, estado, restauranteID, repartidorID string) ([]model.Pedido, int64, error)

	// ListOrdersByDeliverer retrieves orders assigned to a specific deliverer
	ListOrdersByDeliverer(ctx context.Context, repartidorID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error)

	// UpdateOrderStatus updates the order status and creates a state log entry
	UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, newEstado model.EstadoPedido, changedBy *uuid.UUID) (*model.Pedido, error)

	// AcceptOrder assigns a deliverer and changes status to aceptado
	AcceptOrder(ctx context.Context, orderID, repartidorID uuid.UUID) (*model.Pedido, error)

	// CancelOrder cancels an order (only if pendiente)
	CancelOrder(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error)

	// GetOrderHistory retrieves all state changes for an order
	GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error)
}
