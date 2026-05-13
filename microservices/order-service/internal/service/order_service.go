package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PedidosCampus/order-service/internal/config"
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
	cfg          *config.Config
	serviceToken string
	httpClient   *http.Client
}

type restauranteDetalleResponse struct {
	Nombre string `json:"nombre"`
}

type repartidorDetalleResponse struct {
	Nombre   string  `json:"nombre"`
	Telefono *string `json:"telefono"`
}


// NewOrderService creates a new order service
func NewOrderService(repo repository.OrderRepository, publisher rabbitmq.EventPublisher, deliveryCost float64, cfg *config.Config) OrderService {
	return &orderServiceImpl{
		repo:         repo,
		publisher:    publisher,
		deliveryCost: deliveryCost,
		cfg:          cfg,
		serviceToken: cfg.ServiceToken,
		httpClient: &http.Client{
			Timeout: cfg.NotifService.Timeout,
		},
	}
}

// sendNotification sends a notification to the notifications service asynchronously.
// It returns immediately - errors are logged but don't affect the caller.
func (s *orderServiceImpl) sendNotification(userID uuid.UUID, tipo string, mensaje string) {
	go func() {
		notifURL := s.cfg.NotifService.URL
		if notifURL == "" {
			return
		}

		notifEndpoint := strings.TrimRight(notifURL, "/") + "/notifications"
		payload := map[string]interface{}{
			"userId":  userID.String(),
			"tipo":    tipo,
			"mensaje": mensaje,
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			log.Printf("notification marshal failed for user %s: %v", userID.String(), err)
			return
		}

		httpReq, err := http.NewRequest("POST", notifEndpoint, bytes.NewBuffer(jsonData))
		if err != nil {
			log.Printf("notification request creation failed for user %s: %v", userID.String(), err)
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("x-service-token", s.serviceToken)

		resp, err := s.httpClient.Do(httpReq)
		if err != nil {
			log.Printf("notification call failed for user %s: %v", userID.String(), err)
			return
		}
		_ = resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			log.Printf("notification returned status %d for user %s", resp.StatusCode, userID.String())
		}
	}()
}

// CreateOrder creates a new order
func (s *orderServiceImpl) CreateOrder(ctx context.Context, userID uuid.UUID, req dto.CreateOrderRequest) (*model.Pedido, error) {
	// Validate items
	if len(req.Items) == 0 {
		return nil, errors.ErrItemsEmpty
	}

	// Validate products with restaurant service
	if err := s.validateProductsWithRestaurant(ctx, req.RestauranteID, req.Items); err != nil {
		return nil, err
	}

	// Calculate totals
	var subtotal float64
	items := make([]model.PedidoItem, len(req.Items))

	for i, item := range req.Items {
		fieldIndex := strconv.Itoa(i)
		if item.Cantidad < 1 || item.Cantidad > 999 {
			return nil, errors.ErrValidation.WithDetails(map[string]interface{}{
				"field": "items[" + fieldIndex + "].cantidad",
				"issue": "must be between 1 and 999",
				"value": item.Cantidad,
			})
		}

		if item.PrecioUnit < 0 || item.PrecioUnit > 99999.99 {
			return nil, errors.ErrValidation.WithDetails(map[string]interface{}{
				"field": "items[" + fieldIndex + "].precioUnit",
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

func (s *orderServiceImpl) getRestaurantName(ctx context.Context, restauranteID uuid.UUID) string {
	baseURL := strings.TrimRight(s.cfg.RestService.URL, "/")
	if baseURL == "" {
		return ""
	}

	endpoint := fmt.Sprintf("%s/restaurants/%s", baseURL, restauranteID.String())
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return ""
	}

	req.Header.Set("x-service-token", s.serviceToken)

	client := &http.Client{Timeout: s.cfg.RestService.Timeout}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	var payload restauranteDetalleResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return ""
	}

	return strings.TrimSpace(payload.Nombre)
}

func (s *orderServiceImpl) getDelivererInfo(ctx context.Context, repartidorID uuid.UUID) (string, string) {
	baseURL := strings.TrimRight(s.cfg.UserService.URL, "/")
	if baseURL == "" {
		return "", ""
	}

	endpoint := fmt.Sprintf("%s/api/profiles/user/%s", baseURL, repartidorID.String())
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return "", ""
	}

	req.Header.Set("x-service-token", s.serviceToken)

	client := &http.Client{Timeout: s.cfg.UserService.Timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", ""
	}

	var payload repartidorDetalleResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", ""
	}

	phone := ""
	if payload.Telefono != nil {
		phone = strings.TrimSpace(*payload.Telefono)
	}

	return strings.TrimSpace(payload.Nombre), phone
}

// validateProductsWithRestaurant validates products with the restaurant service
func (s *orderServiceImpl) validateProductsWithRestaurant(ctx context.Context, restauranteID uuid.UUID, items []dto.CreateOrderItem) error {
	// Prepare validation request
	validationItems := make([]map[string]interface{}, len(items))
	for i, item := range items {
		validationItems[i] = map[string]interface{}{
			"productId":   item.ProductID.String(),
			"precioUnit":  item.PrecioUnit,
		}
	}

	validationRequest := map[string]interface{}{
		"items": validationItems,
	}

	jsonData, err := json.Marshal(validationRequest)
	if err != nil {
		return errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": "failed to marshal validation request",
		})
	}

	// Make HTTP request to restaurant service
	restaurantURL := s.cfg.RestService.URL
	if restaurantURL == "" {
		restaurantURL = "http://localhost:3000"
	}
	endpoint := fmt.Sprintf("%s/restaurants/products/validate-batch", strings.TrimRight(restaurantURL, "/"))

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": "failed to create validation request",
		})
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-service-token", s.serviceToken)

	client := &http.Client{Timeout: s.cfg.RestService.Timeout}
	resp, err := client.Do(req)
	if err != nil {
		return errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": fmt.Sprintf("failed to connect to restaurant service: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": fmt.Sprintf("restaurant service returned status %d", resp.StatusCode),
		})
	}

	// Parse response
	var validationResp struct {
		Items []struct {
			ProductoID      string   `json:"productoId"`
			OK              bool     `json:"ok"`
			ServidorPrecio  *float64 `json:"servidorPrecio,omitempty"`
			Nombre          *string  `json:"nombre,omitempty"`
			Disponible      *bool    `json:"disponible,omitempty"`
			Error           *string  `json:"error,omitempty"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&validationResp); err != nil {
		return errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": "failed to decode validation response",
		})
	}

	// Check validation results
	for i, result := range validationResp.Items {
		if !result.OK {
			fieldIndex := strconv.Itoa(i)
			errorMsg := "unknown error"
			if result.Error != nil {
				errorMsg = *result.Error
			}
			return errors.ErrValidation.WithDetails(map[string]interface{}{
				"field": fmt.Sprintf("items[%s].productId", fieldIndex),
				"issue": errorMsg,
				"value": items[i].ProductID,
			})
		}
	}

	return nil
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
	if role == "admin" {
		return s.repo.ListOrders(ctx, query.Limit, query.Offset, query.Estado, query.RestauranteID, query.UserID)
	}

	return s.repo.ListOrdersByUser(ctx, userID, query.Limit, query.Offset, query.Estado, query.RestauranteID)
}

// ListActiveOrders retrieves all active orders (admin only)
func (s *orderServiceImpl) ListActiveOrders(ctx context.Context, role string, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	if role != "admin" {
		return nil, 0, errors.ErrForbidden
	}

	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	return s.repo.ListActiveOrders(ctx, query.Limit, query.Offset, query.Estado, query.RestauranteID, query.RepartidorID)
}

// ListDelivererOrders retrieves orders assigned to a specific deliverer
func (s *orderServiceImpl) ListDelivererOrders(ctx context.Context, actorID uuid.UUID, role string, repartidorID uuid.UUID, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	if role != "admin" && role != "repartidor" {
		return nil, 0, errors.ErrForbidden
	}

	if role == "repartidor" && actorID != repartidorID {
		return nil, 0, errors.ErrForbidden.WithDetails(map[string]interface{}{
			"issue": "deliverer can only list own orders",
		})
	}

	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	return s.repo.ListOrdersByDeliverer(ctx, repartidorID, query.Limit, query.Offset, query.Estado)
}

// ListAvailableOrders lists all pending orders without a deliverer (for repartidor to claim)
func (s *orderServiceImpl) ListAvailableOrders(ctx context.Context, role string, query dto.ListOrdersQuery) ([]model.Pedido, int64, error) {
	// Any repartidor or admin can see available orders
	if role != "admin" && role != "repartidor" {
		return nil, 0, errors.ErrForbidden
	}

	// Default pagination
	if query.Limit == 0 {
		query.Limit = 10
	}
	if query.Limit > 100 {
		query.Limit = 100
	}

	return s.repo.ListAvailableOrders(ctx, query.Limit, query.Offset)
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
			Timestamp:    pedido.UpdatedAt.Format(time.RFC3339),
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
			Timestamp:  pedido.UpdatedAt.Format(time.RFC3339),
		}

		go func() {
			s.publisher.PublishOrderAssigned(context.Background(), assignedEvent)
			s.publisher.PublishOrderStatusChanged(context.Background(), statusChangedEvent)
		}()
	}

	// Notify user about order acceptance
	restaurantName := s.getRestaurantName(ctx, pedido.RestauranteID)
	if restaurantName == "" {
		restaurantName = pedido.RestauranteID.String()
	}

	delivererName, delivererPhone := s.getDelivererInfo(ctx, repartidorID)
	if delivererName == "" {
		delivererName = "un repartidor"
	}
	contact := ""
	if delivererPhone != "" {
		contact = fmt.Sprintf(" (%s)", delivererPhone)
	}

	s.sendNotification(
		pedido.UserID,
		"PEDIDO_ACEPTADO",
		fmt.Sprintf("Tu pedido de %s fue aceptado por %s%s.", restaurantName, delivererName, contact),
	)

	return pedido, nil
}

// UpdateOrderStatus updates the order status
func (s *orderServiceImpl) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, role string, req dto.UpdateOrderStatusRequest) (*model.Pedido, error) {
	// Get current order to check authorization
	currentPedido, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Admin can update any order. Repartidor only assigned order.
	if role != "admin" && (currentPedido.RepartidorID == nil || *currentPedido.RepartidorID != actorID) {
		return nil, errors.ErrForbidden.WithDetails(map[string]interface{}{
			"issue": "only assigned deliverer can update status",
		})
	}
	if role != "admin" && role != "repartidor" {
		return nil, errors.ErrForbidden
	}

	newEstado := model.EstadoPedido(req.ToEstado)

	// Update status
	updatedPedido, err := s.repo.UpdateOrderStatus(ctx, orderID, newEstado, &actorID)
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
			ChangedBy:  actorID.String(),
			Estado:     string(updatedPedido.Estado),
			Timestamp:  updatedPedido.UpdatedAt.Format(time.RFC3339),
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
					RepartidorID:  actorID.String(),
					RestauranteID: updatedPedido.RestauranteID.String(),
					DeliveredAt:   updatedPedido.UpdatedAt.Format(time.RFC3339),
				}
				s.publisher.PublishOrderDelivered(context.Background(), deliveredEvent)
			}
		}()
	}

	// Notify user based on new status
	if newEstado == model.EstadoEnCamino || newEstado == model.EstadoEntregado {
		var tipo, mensaje string
		restaurantName := s.getRestaurantName(ctx, updatedPedido.RestauranteID)
		if restaurantName == "" {
			restaurantName = updatedPedido.RestauranteID.String()
		}
		switch newEstado {
		case model.EstadoEnCamino:
			tipo = "PEDIDO_EN_CAMINO"
			mensaje = fmt.Sprintf("Tu pedido de %s está en camino.", restaurantName)
		case model.EstadoEntregado:
			tipo = "PEDIDO_ENTREGADO"
			mensaje = fmt.Sprintf("Tu pedido de %s fue entregado. ¡Que disfrutes tu comida!", restaurantName)
		}
		s.sendNotification(updatedPedido.UserID, tipo, mensaje)
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

	// Notify user about cancellation
	s.sendNotification(
		cancelledPedido.UserID,
		"PEDIDO_CANCELADO",
		fmt.Sprintf("Tu pedido %s ha sido cancelado.", cancelledPedido.ID.String()),
	)

	return cancelledPedido, nil
}

// GetOrderHistory retrieves the state change history of an order
func (s *orderServiceImpl) GetOrderHistory(ctx context.Context, orderID uuid.UUID, userID uuid.UUID, role string) ([]model.PedidoEstadoLog, error) {
	pedido, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	if role != "admin" && pedido.UserID != userID && (pedido.RepartidorID == nil || *pedido.RepartidorID != userID) {
		return nil, errors.ErrForbidden
	}

	return s.repo.GetOrderHistory(ctx, orderID)
}
