package service

import (
	"context"

	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/PedidosCampus/order-service/internal/repository"
	"github.com/PedidosCampus/order-service/pkg/errors"
	"github.com/PedidosCampus/order-service/pkg/rabbitmq"
	"github.com/google/uuid"
)

// orderServiceImpl implements OrderService
type orderServiceImpl struct {
	repo         repository.OrderRepository
	publisher    rabbitmq.EventPublisher
	deliveryCost float64
}

// NewOrderService creates a new order service
func NewOrderService(repo repository.OrderRepository, publisher rabbitmq.EventPublisher, deliveryCost float64) OrderService {
	return &orderServiceImpl{
		repo:         repo,
		publisher:    publisher,
		deliveryCost: deliveryCost,
	}
}

// CreateOrder creates a new order
func (s *orderServiceImpl) CreateOrder(ctx context.Context, userID uuid.UUID, req dto.CreateOrderRequest) (*model.Pedido, error) {
	// Validate items
	if len(req.Items) == 0 {
		return nil, errors.ErrItemsEmpty
	}

	// Calculate totals
	var subtotal float64
	items := make([]model.PedidoItem, len(req.Items))

	for i, item := range req.Items {
		if item.Cantidad < 1 || item.Cantidad > 999 {
			return nil, errors.ErrValidation.WithDetails(map[string]interface{}{
				"field": "items[" + string(rune(i)) + "].cantidad",
				"issue": "must be between 1 and 999",
				"value": item.Cantidad,
			})
		}

		if item.PrecioUnit < 0 || item.PrecioUnit > 99999.99 {
			return nil, errors.ErrValidation.WithDetails(map[string]interface{}{
				"field": "items[" + string(rune(i)) + "].precioUnit",
				"issue": "must be between 0 and 99999.99",
				"value": item.PrecioUnit,
			})
		}

		itemSubtotal := item.PrecioUnit * float64(item.Cantidad)
		subtotal += itemSubtotal

		items[i] = model.PedidoItem{
			ID:         uuid.New(),
			ProductID:  item.ProductID,
			Nombre:     item.Nombre,
			PrecioUnit: item.PrecioUnit,
			Cantidad:   item.Cantidad,
			Subtotal:   itemSubtotal,
		}
	}

	// Create order
	pedido := &model.Pedido{
		ID:               uuid.New(),
		UserID:           userID,
		RestauranteID:    req.RestauranteID,
		Estado:           model.EstadoPendiente,
		Subtotal:         subtotal,
		CostoEntrega:     s.deliveryCost,
		Total:            subtotal + s.deliveryCost,
		DireccionEntrega: req.DireccionEntrega,
	}

	// Create initial state log
	stateLog := model.PedidoEstadoLog{
		ID:         uuid.New(),
		ToEstado:   model.EstadoPendiente,
		FromEstado: nil,
	}

	// Persist in transaction
	createdPedido, err := s.repo.CreateOrder(ctx, pedido, items, stateLog)
	if err != nil {
		return nil, err
	}

	// Publish event AFTER successful commit
	if s.publisher != nil {
		event := rabbitmq.OrderCreatedEvent{
			EventID:       uuid.New().String(),
			EventType:     "order.created",
			OrderID:       createdPedido.ID.String(),
			UserID:        createdPedido.UserID.String(),
			RestauranteID: createdPedido.RestauranteID.String(),
			Subtotal:      createdPedido.Subtotal,
			CostoEntrega:  createdPedido.CostoEntrega,
			Total:         createdPedido.Total,
			Estado:        string(createdPedido.Estado),
			CreatedAt:     createdPedido.CreatedAt.String(),
		}

		// Publish asynchronously to not block
		go func() {
			s.publisher.PublishOrderCreated(context.Background(), event)
		}()
	}

	return createdPedido, nil
}

// GetOrder retrieves an order by ID with authorization check
func (s *orderServiceImpl) GetOrder(ctx context.Context, orderID uuid.UUID, userID uuid.UUID, role string) (*model.Pedido, error) {
	pedido, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Authorization check
	if role != "admin" && pedido.UserID != userID && (pedido.RepartidorID == nil || *pedido.RepartidorID != userID) {
		return nil, errors.ErrForbidden
	}

	return pedido, nil
}

// ListOrders retrieves orders for a user with pagination
func (s *orderServiceImpl) ListOrders(ctx context.Context, userID uuid.UUID, role string, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	// Admin can filter by userId, regular users can only see their own
	if role != "admin" && query.UserID != "" {
		return nil, 0, errors.ErrForbidden
	}

	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	// For regular users, always filter by their own ID
	filterUserID := userID
	if role == "admin" && query.UserID != "" {
		filterUserID, _ = uuid.Parse(query.UserID)
	}

	return s.repo.ListOrdersByUser(ctx, filterUserID, query.Limit, query.Offset, query.Estado)
}

// ListActiveOrders retrieves all active orders (admin only)
func (s *orderServiceImpl) ListActiveOrders(ctx context.Context, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	return s.repo.ListActiveOrders(ctx, query.Limit, query.Offset, query.Estado, query.RestauranteID, "")
}

// ListDelivererOrders retrieves orders assigned to a specific deliverer
func (s *orderServiceImpl) ListDelivererOrders(ctx context.Context, repartidorID uuid.UUID, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	return s.repo.ListOrdersByDeliverer(ctx, repartidorID, query.Limit, query.Offset, query.Estado)
}

// AcceptOrder accepts an order (deliverer assigns themselves)
func (s *orderServiceImpl) AcceptOrder(ctx context.Context, orderID uuid.UUID, repartidorID uuid.UUID) (*model.Pedido, error) {
	pedido, err := s.repo.AcceptOrder(ctx, orderID, repartidorID)
	if err != nil {
		return nil, err
	}

	// Publish events AFTER successful commit
	if s.publisher != nil {
		// order.assigned event
		assignedEvent := rabbitmq.OrderAssignedEvent{
			EventID:      uuid.New().String(),
			EventType:    "order.assigned",
			OrderID:      pedido.ID.String(),
			RepartidorID: repartidorID.String(),
			Estado:       string(pedido.Estado),
			Timestamp:    pedido.UpdatedAt.String(),
		}

		// order.status.changed event
		statusChangedEvent := rabbitmq.OrderStatusChangedEvent{
			EventID:    uuid.New().String(),
			EventType:  "order.status.changed",
			OrderID:    pedido.ID.String(),
			FromEstado: "pendiente",
			ToEstado:   string(pedido.Estado),
			ChangedBy:  repartidorID.String(),
			Estado:     string(pedido.Estado),
			Timestamp:  pedido.UpdatedAt.String(),
		}

		go func() {
			s.publisher.PublishOrderAssigned(context.Background(), assignedEvent)
			s.publisher.PublishOrderStatusChanged(context.Background(), statusChangedEvent)
		}()
	}

	return pedido, nil
}

// UpdateOrderStatus updates the order status
func (s *orderServiceImpl) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, repartidorID uuid.UUID, req dto.UpdateOrderStatusRequest) (*model.Pedido, error) {
	// Get current order to check authorization
	currentPedido, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Only assigned deliverer can update
	if currentPedido.RepartidorID == nil || *currentPedido.RepartidorID != repartidorID {
		return nil, errors.ErrForbidden.WithDetails(map[string]interface{}{
			"issue": "only assigned deliverer can update status",
		})
	}

	newEstado := model.EstadoPedido(req.ToEstado)

	// Update status
	updatedPedido, err := s.repo.UpdateOrderStatus(ctx, orderID, newEstado, &repartidorID)
	if err != nil {
		return nil, err
	}

	// Publish event AFTER successful commit
	if s.publisher != nil {
		statusChangedEvent := rabbitmq.OrderStatusChangedEvent{
			EventID:    uuid.New().String(),
			EventType:  "order.status.changed",
			OrderID:    updatedPedido.ID.String(),
			FromEstado: string(currentPedido.Estado),
			ToEstado:   string(updatedPedido.Estado),
			ChangedBy:  repartidorID.String(),
			Estado:     string(updatedPedido.Estado),
			Timestamp:  updatedPedido.UpdatedAt.String(),
		}

		go func() {
			s.publisher.PublishOrderStatusChanged(context.Background(), statusChangedEvent)

			// If delivered, publish order.delivered event
			if newEstado == model.EstadoEntregado {
				deliveredEvent := rabbitmq.OrderDeliveredEvent{
					EventID:       uuid.New().String(),
					EventType:     "order.delivered",
					OrderID:       updatedPedido.ID.String(),
					UserID:        updatedPedido.UserID.String(),
					RepartidorID:  repartidorID.String(),
					RestauranteID: updatedPedido.RestauranteID.String(),
					DeliveredAt:   updatedPedido.UpdatedAt.String(),
				}
				s.publisher.PublishOrderDelivered(context.Background(), deliveredEvent)
			}
		}()
	}

	return updatedPedido, nil
}

// CancelOrder cancels an order
func (s *orderServiceImpl) CancelOrder(ctx context.Context, orderID uuid.UUID, userID uuid.UUID, role string) (*model.Pedido, error) {
	pedido, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Only order owner or admin can cancel
	if role != "admin" && pedido.UserID != userID {
		return nil, errors.ErrForbidden
	}

	// Cancel order
	cancelledPedido, err := s.repo.CancelOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Publish event AFTER successful commit
	if s.publisher != nil {
		cancelledEvent := rabbitmq.OrderCancelledEvent{
			EventID:      uuid.New().String(),
			EventType:    "order.cancelled",
			OrderID:      cancelledPedido.ID.String(),
			CancelledBy:  userID.String(),
			RevertedFrom: string(pedido.Estado),
		}

		go func() {
			s.publisher.PublishOrderCancelled(context.Background(), cancelledEvent)
		}()
	}

	return cancelledPedido, nil
}

// GetOrderHistory retrieves the state change history of an order
func (s *orderServiceImpl) GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error) {
	return s.repo.GetOrderHistory(ctx, orderID)
}
