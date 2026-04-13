package service

import (
	"context"
	"testing"

	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/PedidosCampus/order-service/pkg/errors"
	"github.com/PedidosCampus/order-service/pkg/rabbitmq"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// MockOrderRepository for testing
type MockOrderRepository struct {
	createdOrders    map[uuid.UUID]*model.Pedido
	orders           map[uuid.UUID]*model.Pedido
	stateTransitions map[string]bool
}

func NewMockOrderRepository() *MockOrderRepository {
	return &MockOrderRepository{
		createdOrders:    make(map[uuid.UUID]*model.Pedido),
		orders:           make(map[uuid.UUID]*model.Pedido),
		stateTransitions: make(map[string]bool),
	}
}

func (m *MockOrderRepository) CreateOrder(ctx context.Context, pedido *model.Pedido, items []model.PedidoItem, stateLog model.PedidoEstadoLog) (*model.Pedido, error) {
	pedido.Items = items
	pedido.Historial = []model.PedidoEstadoLog{stateLog}
	m.createdOrders[pedido.ID] = pedido
	m.orders[pedido.ID] = pedido
	return pedido, nil
}

func (m *MockOrderRepository) GetOrderByID(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	if order, exists := m.orders[orderID]; exists {
		return order, nil
	}
	return nil, errors.ErrOrderNotFound
}

func (m *MockOrderRepository) ListOrdersByUser(ctx context.Context, userID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error) {
	var result []model.Pedido
	for _, order := range m.orders {
		if order.UserID == userID {
			if estado == "" || string(order.Estado) == estado {
				result = append(result, *order)
			}
		}
	}
	return result, int64(len(result)), nil
}

func (m *MockOrderRepository) ListActiveOrders(ctx context.Context, limit, offset int, estado, restauranteID, repartidorID string) ([]model.Pedido, int64, error) {
	var result []model.Pedido
	for _, order := range m.orders {
		if order.Estado != model.EstadoEntregado && order.Estado != model.EstadoCancelado {
			if estado == "" || string(order.Estado) == estado {
				result = append(result, *order)
			}
		}
	}
	return result, int64(len(result)), nil
}

func (m *MockOrderRepository) ListOrdersByDeliverer(ctx context.Context, repartidorID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error) {
	var result []model.Pedido
	for _, order := range m.orders {
		if order.RepartidorID != nil && *order.RepartidorID == repartidorID {
			if estado == "" || string(order.Estado) == estado {
				result = append(result, *order)
			}
		}
	}
	return result, int64(len(result)), nil
}

func (m *MockOrderRepository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, newEstado model.EstadoPedido, changedBy *uuid.UUID) (*model.Pedido, error) {
	order, exists := m.orders[orderID]
	if !exists {
		return nil, errors.ErrOrderNotFound
	}

	if !order.IsValidTransition(newEstado) {
		return nil, errors.ErrInvalidStateTransition
	}

	order.Estado = newEstado
	return order, nil
}

func (m *MockOrderRepository) AcceptOrder(ctx context.Context, orderID, repartidorID uuid.UUID) (*model.Pedido, error) {
	order, exists := m.orders[orderID]
	if !exists {
		return nil, errors.ErrOrderNotFound
	}

	if order.Estado != model.EstadoPendiente {
		return nil, errors.ErrOrderNotPending
	}

	order.RepartidorID = &repartidorID
	order.Estado = model.EstadoAceptado
	return order, nil
}

func (m *MockOrderRepository) CancelOrder(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	order, exists := m.orders[orderID]
	if !exists {
		return nil, errors.ErrOrderNotFound
	}

	if !order.IsCancellable() {
		return nil, errors.NewAppError(errors.Conflict, "Cannot cancel", 409)
	}

	order.Estado = model.EstadoCancelado
	return order, nil
}

func (m *MockOrderRepository) GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error) {
	order, exists := m.orders[orderID]
	if !exists {
		return nil, errors.ErrOrderNotFound
	}
	return order.Historial, nil
}

// Unit Tests

func TestCreateOrder_Success(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	userID := uuid.New()
	restauranteID := uuid.New()
	productID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productID,
				Nombre:     "Hamburguesa Deluxe",
				PrecioUnit: 12.50,
				Cantidad:   2,
			},
		},
	}

	ctx := context.Background()
	pedido, err := svc.CreateOrder(ctx, userID, req)

	assert.NoError(t, err)
	assert.NotNil(t, pedido)
	assert.Equal(t, model.EstadoPendiente, pedido.Estado)
	assert.Equal(t, 25.0, pedido.Subtotal)
	assert.Equal(t, 2.0, pedido.CostoEntrega)
	assert.Equal(t, 27.0, pedido.Total)
	assert.Equal(t, 1, len(pedido.Items))
}

func TestCreateOrder_ValidationError_EmptyItems(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	userID := uuid.New()
	restauranteID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items:            []dto.CreateOrderItem{},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	assert.Equal(t, errors.ErrItemsEmpty, err)
}

func TestAcceptOrder_Success(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	// Create an order first
	orderID := uuid.New()
	userID := uuid.New()
	restauranteID := uuid.New()
	repartidorID := uuid.New()

	order := &model.Pedido{
		ID:            orderID,
		UserID:        userID,
		RestauranteID: restauranteID,
		Estado:        model.EstadoPendiente,
		Total:         25.0,
	}
	repo.orders[orderID] = order

	ctx := context.Background()
	accepted, err := svc.AcceptOrder(ctx, orderID, repartidorID)

	assert.NoError(t, err)
	assert.NotNil(t, accepted)
	assert.Equal(t, model.EstadoAceptado, accepted.Estado)
	assert.Equal(t, repartidorID, *accepted.RepartidorID)
}

func TestAcceptOrder_Error_NotPending(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	orderID := uuid.New()
	userID := uuid.New()
	restauranteID := uuid.New()
	repartidorID := uuid.New()

	order := &model.Pedido{
		ID:            orderID,
		UserID:        userID,
		RestauranteID: restauranteID,
		Estado:        model.EstadoAceptado, // Already accepted
		Total:         25.0,
	}
	repo.orders[orderID] = order

	ctx := context.Background()
	_, err := svc.AcceptOrder(ctx, orderID, repartidorID)

	assert.Error(t, err)
	assert.Equal(t, errors.ErrOrderNotPending, err)
}

func TestUpdateOrderStatus_InvalidTransition(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	orderID := uuid.New()
	userID := uuid.New()
	repartidorID := uuid.New()

	order := &model.Pedido{
		ID:           orderID,
		UserID:       userID,
		RepartidorID: &repartidorID,
		Estado:       model.EstadoPendiente, // Can't go directly to entregado from pendiente
		Total:        25.0,
	}
	repo.orders[orderID] = order

	req := dto.UpdateOrderStatusRequest{
		ToEstado: "entregado",
	}

	ctx := context.Background()
	_, err := svc.UpdateOrderStatus(ctx, orderID, repartidorID, req)

	assert.Error(t, err)
}

func TestCancelOrder_Success(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	orderID := uuid.New()
	userID := uuid.New()

	order := &model.Pedido{
		ID:     orderID,
		UserID: userID,
		Estado: model.EstadoPendiente,
		Total:  25.0,
	}
	repo.orders[orderID] = order

	ctx := context.Background()
	cancelled, err := svc.CancelOrder(ctx, orderID, userID, "usuario")

	assert.NoError(t, err)
	assert.NotNil(t, cancelled)
	assert.Equal(t, model.EstadoCancelado, cancelled.Estado)
}

func TestCancelOrder_Error_NotPending(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	svc := NewOrderService(repo, publisher, 2.0)

	orderID := uuid.New()
	userID := uuid.New()

	order := &model.Pedido{
		ID:     orderID,
		UserID: userID,
		Estado: model.EstadoEntregado, // Can't cancel delivered
		Total:  25.0,
	}
	repo.orders[orderID] = order

	ctx := context.Background()
	_, err := svc.CancelOrder(ctx, orderID, userID, "usuario")

	assert.Error(t, err)
}
