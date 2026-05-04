package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/PedidosCampus/order-service/internal/config"
	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/handler"
	"github.com/PedidosCampus/order-service/internal/middleware"
	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/PedidosCampus/order-service/internal/repository"
	"github.com/PedidosCampus/order-service/internal/service"
	"github.com/PedidosCampus/order-service/pkg/errors"
	"github.com/PedidosCampus/order-service/pkg/rabbitmq"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockOrderRepository for testing
type TestMockOrderRepository struct {
	orders map[uuid.UUID]*model.Pedido
}

func NewTestMockOrderRepository() *TestMockOrderRepository {
	return &TestMockOrderRepository{
		orders: make(map[uuid.UUID]*model.Pedido),
	}
}

func (m *TestMockOrderRepository) CreateOrder(ctx context.Context, pedido *model.Pedido, items []model.PedidoItem, stateLog model.PedidoEstadoLog) (*model.Pedido, error) {
	pedido.Items = items
	pedido.Historial = []model.PedidoEstadoLog{stateLog}
	m.orders[pedido.ID] = pedido
	return pedido, nil
}

func (m *TestMockOrderRepository) GetOrderByID(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	if order, exists := m.orders[orderID]; exists {
		return order, nil
	}
	return nil, errors.ErrOrderNotFound
}

func (m *TestMockOrderRepository) ListOrdersByUser(ctx context.Context, userID uuid.UUID, limit, offset int, estado, restauranteID string) ([]model.Pedido, int64, error) {
	return nil, 0, nil
}

func (m *TestMockOrderRepository) ListOrders(ctx context.Context, limit, offset int, estado, restauranteID, userID string) ([]model.Pedido, int64, error) {
	return nil, 0, nil
}

func (m *TestMockOrderRepository) ListActiveOrders(ctx context.Context, limit, offset int, estado, restauranteID, repartidorID string) ([]model.Pedido, int64, error) {
	return nil, 0, nil
}

func (m *TestMockOrderRepository) ListOrdersByDeliverer(ctx context.Context, repartidorID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error) {
	return nil, 0, nil
}

func (m *TestMockOrderRepository) AcceptOrder(ctx context.Context, orderID, repartidorID uuid.UUID) (*model.Pedido, error) {
	order, exists := m.orders[orderID]
	if !exists {
		return nil, errors.ErrOrderNotFound
	}

	if order.Estado != model.EstadoPendiente {
		return nil, errors.ErrOrderNotPending
	}

	order.Estado = model.EstadoAceptado
	order.RepartidorID = &repartidorID
	return order, nil
}

func (m *TestMockOrderRepository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, newEstado model.EstadoPedido, changedBy *uuid.UUID) (*model.Pedido, error) {
	return nil, nil
}

func (m *TestMockOrderRepository) CancelOrder(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	return nil, nil
}

func (m *TestMockOrderRepository) GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error) {
	return nil, nil
}

var _ repository.OrderRepository = (*TestMockOrderRepository)(nil)

// Test: Repartidor accepts order with matching userId (SHOULD SUCCEED)
func TestAcceptOrder_ValidRequest_SameDeliverer(t *testing.T) {
	gin.SetMode(gin.TestMode)

	repo := NewTestMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := service.NewOrderService(repo, publisher, 2.0, cfg)
	h := handler.NewOrderHandler(svc)

	orderID := uuid.New()
	userID := uuid.New()
	restauranteID := uuid.New()

	// Create a pending order
	order := &model.Pedido{
		ID:            orderID,
		UserID:        uuid.New(),
		RestauranteID: restauranteID,
		Estado:        model.EstadoPendiente,
		Total:         25.0,
	}
	repo.orders[orderID] = order

	// Create request body with SAME repartidorId as token userId
	body := dto.AcceptOrderRequest{
		RepartidorID: userID,
	}
	bodyBytes, _ := json.Marshal(body)

	// Create HTTP request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/orders/"+orderID.String()+"/accept", bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "orderId", Value: orderID.String()}}

	// Set context values (simulating JWT middleware)
	c.Set(middleware.UserIDKey, userID.String())
	c.Set(middleware.RoleKey, "repartidor")

	// Call handler
	h.AcceptOrder(c)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var response dto.OrderResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, orderID, response.ID)
	assert.Equal(t, model.EstadoAceptado, model.EstadoPedido(response.Estado))
	assert.Equal(t, userID, *response.RepartidorID)
}

// Test: Repartidor tries to accept order with DIFFERENT repartidorId (SHOULD FAIL with 403 Forbidden)
func TestAcceptOrder_InvalidRequest_DifferentDeliverer(t *testing.T) {
	gin.SetMode(gin.TestMode)

	repo := NewTestMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := service.NewOrderService(repo, publisher, 2.0, cfg)
	h := handler.NewOrderHandler(svc)

	orderID := uuid.New()
	tokenUserID := uuid.New()      // User authenticated in token
	bodyRepartidorID := uuid.New() // DIFFERENT from token userId
	restauranteID := uuid.New()

	// Create a pending order
	order := &model.Pedido{
		ID:            orderID,
		UserID:        uuid.New(),
		RestauranteID: restauranteID,
		Estado:        model.EstadoPendiente,
		Total:         25.0,
	}
	repo.orders[orderID] = order

	// Create request body with DIFFERENT repartidorId than token userId
	body := dto.AcceptOrderRequest{
		RepartidorID: bodyRepartidorID,
	}
	bodyBytes, _ := json.Marshal(body)

	// Create HTTP request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/orders/"+orderID.String()+"/accept", bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "orderId", Value: orderID.String()}}

	// Set context values (simulating JWT middleware)
	// NOTE: tokenUserID != bodyRepartidorID
	c.Set(middleware.UserIDKey, tokenUserID.String())
	c.Set(middleware.RoleKey, "repartidor")

	// Call handler
	h.AcceptOrder(c)

	// Verify response: should be 403 Forbidden
	assert.Equal(t, http.StatusForbidden, w.Code)

	var errResponse errors.AppError
	err := json.Unmarshal(w.Body.Bytes(), &errResponse)
	require.NoError(t, err)
	assert.Equal(t, string(errors.Forbidden), string(errResponse.Code))
	assert.Equal(t, "Access forbidden", errResponse.Message)
	// Verify details contain the explanation
	if details := errResponse.Details; details != nil {
		assert.Equal(t, "deliverer can only accept orders for themselves", details["issue"])
	}
}

// Test: Invalid orderId format (malformed UUID)
func TestAcceptOrder_InvalidOrderID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	repo := NewTestMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := service.NewOrderService(repo, publisher, 2.0, cfg)
	h := handler.NewOrderHandler(svc)

	userID := uuid.New()
	invalidOrderID := "not-a-uuid"

	// Create request body
	body := dto.AcceptOrderRequest{
		RepartidorID: userID,
	}
	bodyBytes, _ := json.Marshal(body)

	// Create HTTP request with invalid orderId
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/orders/"+invalidOrderID+"/accept", bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "orderId", Value: invalidOrderID}}

	// Set context values
	c.Set(middleware.UserIDKey, userID.String())
	c.Set(middleware.RoleKey, "repartidor")

	// Call handler
	h.AcceptOrder(c)

	// Verify response
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResponse errors.AppError
	err := json.Unmarshal(w.Body.Bytes(), &errResponse)
	require.NoError(t, err)
	assert.Equal(t, string(errors.ValidationError), string(errResponse.Code))
}

// Test: Order not found
func TestAcceptOrder_OrderNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	repo := NewTestMockOrderRepository()
	publisher := rabbitmq.NewMockPublisher()
	cfg := &config.Config{
		RestService: config.ServiceConfig{
			URL:     "http://localhost:3002",
			Timeout: 5 * time.Second,
		},
	}
	svc := service.NewOrderService(repo, publisher, 2.0, cfg)
	h := handler.NewOrderHandler(svc)

	orderID := uuid.New()
	userID := uuid.New()

	// Do NOT create order in repo (it will be not found)

	// Create request body
	body := dto.AcceptOrderRequest{
		RepartidorID: userID,
	}
	bodyBytes, _ := json.Marshal(body)

	// Create HTTP request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/orders/"+orderID.String()+"/accept", bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "orderId", Value: orderID.String()}}

	// Set context values
	c.Set(middleware.UserIDKey, userID.String())
	c.Set(middleware.RoleKey, "repartidor")

	// Call handler
	h.AcceptOrder(c)

	// Verify response: should be 404 Not Found
	assert.Equal(t, http.StatusNotFound, w.Code)

	var errResponse errors.AppError
	err := json.Unmarshal(w.Body.Bytes(), &errResponse)
	require.NoError(t, err)
	assert.Equal(t, string(errors.NotFound), string(errResponse.Code))
}
