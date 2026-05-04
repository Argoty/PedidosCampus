package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/PedidosCampus/order-service/internal/config"
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

func (m *MockOrderRepository) ListOrdersByUser(ctx context.Context, userID uuid.UUID, limit, offset int, estado, restauranteID string) ([]model.Pedido, int64, error) {
	var result []model.Pedido
	for _, order := range m.orders {
		if order.UserID == userID {
			if (estado == "" || string(order.Estado) == estado) && (restauranteID == "" || order.RestauranteID.String() == restauranteID) {
				result = append(result, *order)
			}
		}
	}
	return result, int64(len(result)), nil
}

func (m *MockOrderRepository) ListOrders(ctx context.Context, limit, offset int, estado, restauranteID, userID string) ([]model.Pedido, int64, error) {
	var result []model.Pedido
	for _, order := range m.orders {
		if (estado == "" || string(order.Estado) == estado) &&
			(restauranteID == "" || order.RestauranteID.String() == restauranteID) &&
			(userID == "" || order.UserID.String() == userID) {
			result = append(result, *order)
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
		return nil, errors.ErrOrderNotPending
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
	// Set up a mock HTTP server for the restaurant service
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			// Decode the request
			var req struct {
				Items []struct {
					ProductID   string  `json:"productId"`
					PrecioUnit  float64 `json:"precioUnit"`
				} `json:"items"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			// Prepare response: all items are valid
			respItems := make([]struct {
				ProductoID string  `json:"productoId"`
				OK         bool    `json:"ok"`
				ServidorPrecio *float64 `json:"servidorPrecio,omitempty"`
				Nombre     *string `json:"nombre,omitempty"`
				Disponible *bool   `json:"disponible,omitempty"`
				Error      *string `json:"error,omitempty"`
			}, len(req.Items))

			for i, item := range req.Items {
				respItems[i] = struct {
					ProductoID string  `json:"productoId"`
					OK         bool    `json:"ok"`
					ServidorPrecio *float64 `json:"servidorPrecio,omitempty"`
					Nombre     *string `json:"nombre,omitempty"`
					Disponible *bool   `json:"disponible,omitempty"`
					Error      *string `json:"error,omitempty"`
				}{
					ProductoID: item.ProductID,
					OK:         true,
					ServidorPrecio: &item.PrecioUnit,
					Nombre:     func() *string { s := "Test Product"; return &s }(),
					Disponible: func() *bool { b := true; return &b }(),
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"items": respItems,
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a config that points to our test server
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
	// We don't need the mock server for this test because it fails before validation
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing (URL doesn't matter for this test)
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://unused",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

func TestCreateOrder_ValidationError_PriceMismatch(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{
						"productoId":     "test-product-id",
						"ok":             false,
						"servidorPrecio": 15.00,
						"nombre":         "Hamburguesa Deluxe",
						"disponible":     true,
						"error":          "price mismatch: client sent 12.50, server has 15.00",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
				Cantidad:   1,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.ValidationError, appErr.Code)
}

func TestCreateOrder_ValidationError_ProductUnavailable(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{
						"productoId": "test-product-id",
						"ok":         false,
						"nombre":     "Pizza Napolitana",
						"disponible": false,
						"error":      "product is not available",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	restauranteID := uuid.New()
	productID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productID,
				Nombre:     "Pizza Napolitana",
				PrecioUnit: 18.00,
				Cantidad:   1,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.ValidationError, appErr.Code)
}

func TestCreateOrder_ValidationError_ProductNotFound(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{
						"productoId": "non-existent-id",
						"ok":         false,
						"error":      "product not found",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	restauranteID := uuid.New()
	productID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productID,
				Nombre:     "Ghost Product",
				PrecioUnit: 10.00,
				Cantidad:   1,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.ValidationError, appErr.Code)
}

func TestCreateOrder_RestaurantService_HTTP500(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"internal server error"}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	restauranteID := uuid.New()
	productID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productID,
				Nombre:     "Test Product",
				PrecioUnit: 10.00,
				Cantidad:   1,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.InternalError, appErr.Code)
}

func TestCreateOrder_RestaurantService_Timeout(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			time.Sleep(2 * time.Second)
			w.WriteHeader(http.StatusOK)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 100 * time.Millisecond,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	restauranteID := uuid.New()
	productID := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productID,
				Nombre:     "Test Product",
				PrecioUnit: 10.00,
				Cantidad:   1,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.InternalError, appErr.Code)
}

func TestCreateOrder_ValidationError_MultipleItems_OneFails(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{
						"productoId":     "product-ok",
						"ok":             true,
						"servidorPrecio": 12.50,
						"nombre":         "Burger",
						"disponible":     true,
					},
					{
						"productoId": "product-fail",
						"ok":         false,
						"error":      "product not found",
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     ts.URL,
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	restauranteID := uuid.New()
	productOK := uuid.New()
	productFail := uuid.New()

	req := dto.CreateOrderRequest{
		RestauranteID:    restauranteID,
		DireccionEntrega: "Cra 5 # 20-30, Apt 304",
		Items: []dto.CreateOrderItem{
			{
				ProductID:  productOK,
				Nombre:     "Burger",
				PrecioUnit: 12.50,
				Cantidad:   1,
			},
			{
				ProductID:  productFail,
				Nombre:     "Ghost Item",
				PrecioUnit: 8.00,
				Cantidad:   2,
			},
		},
	}

	ctx := context.Background()
	_, err := svc.CreateOrder(ctx, userID, req)

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.ValidationError, appErr.Code)
	details, hasDetails := appErr.Details["field"].(string)
	assert.True(t, hasDetails)
	assert.Contains(t, details, "items[1].productId")
}

func TestAcceptOrder_Success(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
	_, err := svc.UpdateOrderStatus(ctx, orderID, repartidorID, "repartidor", req)

	assert.Error(t, err)
}

func TestCancelOrder_Success(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

func TestListActiveOrders_ForbiddenForNonAdmin(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	ctx := context.Background()
	_, _, err := svc.ListActiveOrders(ctx, "usuario", dto.ListOrdersQuery{Limit: 10, Offset: 0})

	assert.Error(t, err)
	assert.Equal(t, errors.ErrForbidden, err)
}

func TestListDelivererOrders_ForbiddenForOtherDeliverer(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	actorID := uuid.New()
	requestedDelivererID := uuid.New()

	ctx := context.Background()
	_, _, err := svc.ListDelivererOrders(ctx, actorID, "repartidor", requestedDelivererID, dto.ListOrdersQuery{Limit: 10, Offset: 0})

	assert.Error(t, err)
	appErr, ok := err.(*errors.AppError)
	assert.True(t, ok)
	assert.Equal(t, errors.Forbidden, appErr.Code)
}

func TestGetOrderHistory_ForbiddenForUnrelatedUser(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	orderID := uuid.New()
	ownerID := uuid.New()
	otherUserID := uuid.New()

	repo.orders[orderID] = &model.Pedido{
		ID:     orderID,
		UserID: ownerID,
		Estado: model.EstadoPendiente,
	}

	ctx := context.Background()
	_, err := svc.GetOrderHistory(ctx, orderID, otherUserID, "usuario")

	assert.Error(t, err)
	assert.Equal(t, errors.ErrForbidden, err)
}

func TestListOrders_AdminCanListAllWithFilters(t *testing.T) {
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	// Create a mock config for testing
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userA := uuid.New()
	userB := uuid.New()
	restA := uuid.New()
	restB := uuid.New()

	repo.orders[uuid.New()] = &model.Pedido{ID: uuid.New(), UserID: userA, RestauranteID: restA, Estado: model.EstadoPendiente}
	repo.orders[uuid.New()] = &model.Pedido{ID: uuid.New(), UserID: userB, RestauranteID: restB, Estado: model.EstadoAceptado}

	ctx := context.Background()
	orders, total, err := svc.ListOrders(ctx, uuid.New(), "admin", dto.ListOrdersQuery{
		Limit:  10,
		Offset: 0,
		UserID: userB.String(),
	})

	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, orders, 1)
	assert.Equal(t, userB, orders[0].UserID)
}

func TestCreateOrder_NotificationSent_Success(t *testing.T) {
	var receivedBody map[string]interface{}
	notificationReceived := make(chan struct{})

	// Mock restaurant service
	restTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{"productoId": "test", "ok": true, "servidorPrecio": 12.50, "nombre": "Test", "disponible": true},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer restTs.Close()

	// Mock notifications service
	notifTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/notifications" {
			assert.Equal(t, "test-service-token", r.Header.Get("x-service-token"))
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

			if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			close(notificationReceived)
			return
		}
		http.NotFound(w, r)
	}))
	defer notifTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     restTs.URL,
			Timeout: 5 * time.Second,
		},
		NotifService: config.ServiceConfig{
			URL:     notifTs.URL,
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

	// Wait for async notification call with timeout
	select {
	case <-notificationReceived:
		// Success
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for notification")
	}

	assert.Equal(t, userID.String(), receivedBody["userId"])
	assert.Equal(t, "PEDIDO_CREADO", receivedBody["tipo"])
	assert.Contains(t, receivedBody["mensaje"], restauranteID.String())
}

func TestCreateOrder_NotificationFails_OrderStillSucceeds(t *testing.T) {
	notificationReceived := make(chan struct{})

	// Mock restaurant service
	restTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{"productoId": "test", "ok": true, "servidorPrecio": 12.50, "nombre": "Test", "disponible": true},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer restTs.Close()

	// Mock notifications service that returns 500
	notifTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"internal error"}`))
		close(notificationReceived)
	}))
	defer notifTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     restTs.URL,
			Timeout: 5 * time.Second,
		},
		NotifService: config.ServiceConfig{
			URL:     notifTs.URL,
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

	// Wait for async notification attempt with timeout
	select {
	case <-notificationReceived:
		// Notification was attempted (even though it failed)
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for notification")
	}
}

func TestCreateOrder_NotificationTimeout_OrderStillSucceeds(t *testing.T) {
	// Mock restaurant service
	restTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{"productoId": "test", "ok": true, "servidorPrecio": 12.50, "nombre": "Test", "disponible": true},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer restTs.Close()

	// Mock notifications service that returns connection refused
	// (simulates unreachable service without waiting for full timeout)
	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     restTs.URL,
			Timeout: 5 * time.Second,
		},
		NotifService: config.ServiceConfig{
			URL:     "http://127.0.0.1:1", // Invalid port, immediate connection refused
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

	// Give time for async notification attempt to fail
	time.Sleep(100 * time.Millisecond)
}

func TestCreateOrder_NotificationEmptyURL_SkipsCall(t *testing.T) {
	// Mock restaurant service
	restTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/products/validate-batch" {
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{"productoId": "test", "ok": true, "servidorPrecio": 12.50, "nombre": "Test", "disponible": true},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer restTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     restTs.URL,
			Timeout: 5 * time.Second,
		},
		// NotifService URL is empty, so no notification should be sent
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

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

	// Give time for async goroutine to potentially run
	time.Sleep(50 * time.Millisecond)
}

// TestAcceptOrder_NotificationSent verifies that AcceptOrder sends a notification
func TestAcceptOrder_NotificationSent(t *testing.T) {
	var receivedBody map[string]interface{}
	notificationReceived := make(chan struct{})

	// Mock notifications service
	notifTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/notifications" {
			assert.Equal(t, "test-service-token", r.Header.Get("x-service-token"))
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

			if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			close(notificationReceived)
			return
		}
		http.NotFound(w, r)
	}))
	defer notifTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		NotifService: config.ServiceConfig{
			URL:     notifTs.URL,
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

	// Create a pending order first
	userID := uuid.New()
	repartidorID := uuid.New()
	pedido := &model.Pedido{
		ID:               uuid.New(),
		UserID:           userID,
		RestauranteID:    uuid.New(),
		DireccionEntrega: "Calle 123",
		Estado:           model.EstadoPendiente,
		Subtotal:          100,
		CostoEntrega:      200,
		Total:             300,
	}
	repo.orders[pedido.ID] = pedido

	ctx := context.Background()
	updatedPedido, err := svc.AcceptOrder(ctx, pedido.ID, repartidorID)

	assert.NoError(t, err)
	assert.NotNil(t, updatedPedido)
	assert.Equal(t, model.EstadoAceptado, updatedPedido.Estado)

	// Wait for async notification call with timeout
	select {
	case <-notificationReceived:
		// Success
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for notification")
	}

	assert.Equal(t, userID.String(), receivedBody["userId"])
	assert.Equal(t, "PEDIDO_ACEPTADO", receivedBody["tipo"])
	assert.Contains(t, receivedBody["mensaje"], pedido.ID.String())
}

// TestUpdateOrderStatus_EnCaminoNotification verifies notification on status change to en_camino
func TestUpdateOrderStatus_EnCaminoNotification(t *testing.T) {
	var receivedBody map[string]interface{}
	notificationReceived := make(chan struct{})

	notifTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/notifications" {
			assert.Equal(t, "test-service-token", r.Header.Get("x-service-token"))

			if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			close(notificationReceived)
			return
		}
		http.NotFound(w, r)
	}))
	defer notifTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		NotifService: config.ServiceConfig{
			URL:     notifTs.URL,
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	repartidorID := uuid.New()
	pedido := &model.Pedido{
		ID:              uuid.New(),
		UserID:          userID,
		RestauranteID:   uuid.New(),
		DireccionEntrega: "Calle 123",
		Estado:          model.EstadoAceptado,
		RepartidorID:    &repartidorID,
		Subtotal:        100,
		CostoEntrega:    200,
		Total:           300,
	}
	repo.orders[pedido.ID] = pedido

	ctx := context.Background()
	req := dto.UpdateOrderStatusRequest{ToEstado: "en_camino"}
	updatedPedido, err := svc.UpdateOrderStatus(ctx, pedido.ID, repartidorID, "repartidor", req)

	assert.NoError(t, err)
	assert.NotNil(t, updatedPedido)
	assert.Equal(t, model.EstadoEnCamino, updatedPedido.Estado)

	// Wait for async notification call with timeout
	select {
	case <-notificationReceived:
		// Success
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for notification")
	}

	assert.Equal(t, userID.String(), receivedBody["userId"])
	assert.Equal(t, "PEDIDO_EN_CAMINO", receivedBody["tipo"])
	assert.Contains(t, receivedBody["mensaje"], pedido.ID.String())
}

// TestCancelOrder_NotificationSent verifies that CancelOrder sends a notification
func TestCancelOrder_NotificationSent(t *testing.T) {
	var receivedBody map[string]interface{}
	notificationReceived := make(chan struct{})

	notifTs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/notifications" {
			assert.Equal(t, "test-service-token", r.Header.Get("x-service-token"))

			if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			close(notificationReceived)
			return
		}
		http.NotFound(w, r)
	}))
	defer notifTs.Close()

	repo := NewMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		NotifService: config.ServiceConfig{
			URL:     notifTs.URL,
			Timeout: 5 * time.Second,
		},
		ServiceToken: "test-service-token",
	}

	svc := NewOrderService(repo, publisher, 2.0, cfg)

	userID := uuid.New()
	pedido := &model.Pedido{
		ID:              uuid.New(),
		UserID:          userID,
		RestauranteID:   uuid.New(),
		DireccionEntrega: "Calle 123",
		Estado:          model.EstadoPendiente,
		Subtotal:        100,
		CostoEntrega:    200,
		Total:           300,
	}
	repo.orders[pedido.ID] = pedido

	ctx := context.Background()
	cancelledPedido, err := svc.CancelOrder(ctx, pedido.ID, userID, "usuario")

	assert.NoError(t, err)
	assert.NotNil(t, cancelledPedido)
	assert.Equal(t, model.EstadoCancelado, cancelledPedido.Estado)

	// Wait for async notification call with timeout
	select {
	case <-notificationReceived:
		// Success
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for notification")
	}

	assert.Equal(t, userID.String(), receivedBody["userId"])
	assert.Equal(t, "PEDIDO_CANCELADO", receivedBody["tipo"])
	assert.Contains(t, receivedBody["mensaje"], pedido.ID.String())
}