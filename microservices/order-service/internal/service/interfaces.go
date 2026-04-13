package service

import (
	"context"

	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/google/uuid"
)

// OrderService defines business logic methods for orders
type OrderService interface {
	// CreateOrder creates a new order
	CreateOrder(ctx context.Context, userID uuid.UUID, req dto.CreateOrderRequest) (*model.Pedido, error)

	// GetOrder retrieves an order by ID
	GetOrder(ctx context.Context, orderID uuid.UUID, userID uuid.UUID, role string) (*model.Pedido, error)

	// ListOrders retrieves orders for a user with pagination
	ListOrders(ctx context.Context, userID uuid.UUID, role string, query dto.ListOrdersQuery) ([]model.Pedido, int64, error)

	// ListActiveOrders retrieves all active orders (admin only)
	ListActiveOrders(ctx context.Context, query dto.ListOrdersQuery) ([]model.Pedido, int64, error)

	// ListDelivererOrders retrieves orders assigned to a specific deliverer
	ListDelivererOrders(ctx context.Context, repartidorID uuid.UUID, query dto.ListOrdersQuery) ([]model.Pedido, int64, error)

	// AcceptOrder accepts an order (deliverer assigns themselves)
	AcceptOrder(ctx context.Context, orderID uuid.UUID, repartidorID uuid.UUID) (*model.Pedido, error)

	// UpdateOrderStatus updates the order status
	UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, repartidorID uuid.UUID, req dto.UpdateOrderStatusRequest) (*model.Pedido, error)

	// CancelOrder cancels an order
	CancelOrder(ctx context.Context, orderID uuid.UUID, userID uuid.UUID, role string) (*model.Pedido, error)

	// GetOrderHistory retrieves the state change history of an order
	GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error)
}
