package handler

import (
	"log"
	"net/http"

	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/middleware"
	"github.com/PedidosCampus/order-service/internal/service"
	"github.com/PedidosCampus/order-service/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// OrderHandler handles HTTP requests for orders
type OrderHandler struct {
	service service.OrderService
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(svc service.OrderService) *OrderHandler {
	return &OrderHandler{
		service: svc,
	}
}

// CreateOrder handles POST /orders
// @Summary Create a new order
// @Description Create a new order for a user
// @Tags orders
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body dto.CreateOrderRequest true "Create order request"
// @Success 201 {object} dto.OrderResponse
// @Failure 400 {object} errors.AppError
// @Failure 401 {object} errors.AppError
// @Router /orders [post]
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req dto.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp := errors.ErrValidation.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, errResp)
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedido, err := h.service.CreateOrder(c.Request.Context(), userID, req)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	c.JSON(http.StatusCreated, mapPedidoToResponse(pedido))
}

// GetOrder handles GET /orders/:orderId
// @Summary Get an order by ID
// @Description Get a specific order with all details
// @Tags orders
// @Security Bearer
// @Param orderId path string true "Order ID"
// @Success 200 {object} dto.OrderResponse
// @Failure 403 {object} errors.AppError
// @Failure 404 {object} errors.AppError
// @Router /orders/{orderId} [get]
func (h *OrderHandler) GetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "orderId",
			"issue": "invalid UUID format",
		}))
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedido, err := h.service.GetOrder(c.Request.Context(), orderID, userID, role)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	c.JSON(http.StatusOK, mapPedidoToResponse(pedido))
}

// ListOrders handles GET /orders
// @Summary List orders
// @Description List orders with pagination and filtering
// @Tags orders
// @Security Bearer
// @Param limit query int false "Limit (default 10, max 100)"
// @Param offset query int false "Offset (default 0)"
// @Param estado query string false "Filter by state"
// @Success 200 {object} dto.PaginatedResponse
// @Router /orders [get]
func (h *OrderHandler) ListOrders(c *gin.Context) {
	var query dto.ListOrdersQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation)
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedidos, total, err := h.service.ListOrders(c.Request.Context(), userID, role, query)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	responses := make([]dto.OrderResponse, len(pedidos))
	for i, p := range pedidos {
		responses[i] = mapPedidoToResponse(&p)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data: responses,
		Pagination: dto.PaginationMetadata{
			Limit:  query.Limit,
			Offset: query.Offset,
			Total:  total,
		},
	})
}

// ListActiveOrders handles GET /orders/active
// @Summary List active orders (admin only)
// @Description List all active orders with pagination and filtering
// @Tags orders
// @Security Bearer
// @Param limit query int false "Limit (default 10, max 100)"
// @Param offset query int false "Offset (default 0)"
// @Param estado query string false "Filter by state"
// @Param restauranteId query string false "Filter by restaurant"
// @Success 200 {object} dto.PaginatedResponse
// @Router /orders/active [get]
func (h *OrderHandler) ListActiveOrders(c *gin.Context) {
	var query dto.ListOrdersQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedidos, total, err := h.service.ListActiveOrders(c.Request.Context(), role, query)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	responses := make([]dto.OrderResponse, len(pedidos))
	for i, p := range pedidos {
		responses[i] = mapPedidoToResponse(&p)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data: responses,
		Pagination: dto.PaginationMetadata{
			Limit:  query.Limit,
			Offset: query.Offset,
			Total:  total,
		},
	})
}

// ListDelivererOrders handles GET /orders/deliverer/:repartidorId
// @Summary List orders for a deliverer
// @Description List orders assigned to a specific deliverer
// @Tags orders
// @Security Bearer
// @Param repartidorId path string true "Deliverer ID"
// @Param limit query int false "Limit (default 10, max 100)"
// @Param offset query int false "Offset (default 0)"
// @Param estado query string false "Filter by state"
// @Success 200 {object} dto.PaginatedResponse
// @Router /orders/deliverer/{repartidorId} [get]
func (h *OrderHandler) ListDelivererOrders(c *gin.Context) {
	repartidorID, err := uuid.Parse(c.Param("repartidorId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "repartidorId",
			"issue": "invalid UUID format",
		}))
		return
	}

	var query dto.ListOrdersQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation)
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedidos, total, err := h.service.ListDelivererOrders(c.Request.Context(), userID, role, repartidorID, query)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	responses := make([]dto.OrderResponse, len(pedidos))
	for i, p := range pedidos {
		responses[i] = mapPedidoToResponse(&p)
	}

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data: responses,
		Pagination: dto.PaginationMetadata{
			Limit:  query.Limit,
			Offset: query.Offset,
			Total:  total,
		},
	})
}

// AcceptOrder handles POST /orders/:orderId/accept
// @Summary Accept an order (deliverer)
// @Description Accept an order for delivery
// @Tags orders
// @Security Bearer
// @Param orderId path string true "Order ID"
// @Param request body dto.AcceptOrderRequest true "Accept order request"
// @Success 200 {object} dto.OrderResponse
// @Failure 409 {object} errors.AppError
// @Router /orders/{orderId}/accept [post]
func (h *OrderHandler) AcceptOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "orderId",
			"issue": "invalid UUID format",
		}))
		return
	}
	log.Printf("[AcceptOrder] start orderId=%s", orderID.String())

	var req dto.AcceptOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[AcceptOrder] bind error: %v", err)
		errResp := errors.ErrValidation.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, errResp)
		return
	}

	// Extract userId from token
	userID, err := middleware.GetUserID(c)
	if err != nil {
		log.Printf("[AcceptOrder] token userId missing or invalid: %v", err)
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	// Log token-derived values for debugging
	log.Printf("[AcceptOrder] token userId=%s", userID.String())
	if role, roleErr := middleware.GetRole(c); roleErr == nil {
		log.Printf("[AcceptOrder] token role=%s", role)
	} else {
		log.Printf("[AcceptOrder] token role missing or invalid: %v", roleErr)
	}

	log.Printf("[AcceptOrder] payload repartidorId=%s", req.RepartidorID.String())

	// SECURITY: Validate that repartidor in token matches repartidor in body
	if userID != req.RepartidorID {
		log.Printf("[AcceptOrder] security violation: token userId=%s != body repartidorId=%s", userID.String(), req.RepartidorID.String())
		c.JSON(http.StatusForbidden, errors.ErrForbidden.WithDetails(map[string]interface{}{
			"issue": "deliverer can only accept orders for themselves",
		}))
		return
	}

	pedido, err := h.service.AcceptOrder(c.Request.Context(), orderID, req.RepartidorID)
	if err != nil {
		log.Printf("[AcceptOrder] service error: %v", err)
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			log.Printf("[AcceptOrder] app error code=%s status=%d message=%s", appErr.Code, appErr.HTTPStatus, appErr.Message)
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		log.Printf("[AcceptOrder] internal error: %s", appErr.Message)
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	log.Printf("[AcceptOrder] success orderId=%s estado=%s repartidor=%v", pedido.ID.String(), pedido.Estado, pedido.RepartidorID)
	c.JSON(http.StatusOK, mapPedidoToResponse(pedido))
}

// UpdateOrderStatus handles POST /orders/:orderId/status
// @Summary Update order status
// @Description Update the status of an order (deliverer only)
// @Tags orders
// @Security Bearer
// @Param orderId path string true "Order ID"
// @Param request body dto.UpdateOrderStatusRequest true "Update status request"
// @Success 200 {object} dto.OrderResponse
// @Failure 400 {object} errors.AppError
// @Failure 409 {object} errors.AppError
// @Router /orders/{orderId}/status [post]
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "orderId",
			"issue": "invalid UUID format",
		}))
		return
	}

	var req dto.UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResp := errors.ErrValidation.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, errResp)
		return
	}

	repartidorID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedido, err := h.service.UpdateOrderStatus(c.Request.Context(), orderID, repartidorID, role, req)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	c.JSON(http.StatusOK, mapPedidoToResponse(pedido))
}

// CancelOrder handles POST /orders/:orderId/cancel
// @Summary Cancel an order
// @Description Cancel a pending order
// @Tags orders
// @Security Bearer
// @Param orderId path string true "Order ID"
// @Param request body dto.CancelOrderRequest true "Cancel order request"
// @Success 200 {object} dto.OrderResponse
// @Failure 409 {object} errors.AppError
// @Router /orders/{orderId}/cancel [post]
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "orderId",
			"issue": "invalid UUID format",
		}))
		return
	}

	var req dto.CancelOrderRequest
	c.ShouldBindJSON(&req)

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	pedido, err := h.service.CancelOrder(c.Request.Context(), orderID, userID, role)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	c.JSON(http.StatusOK, mapPedidoToResponse(pedido))
}

// GetOrderHistory handles GET /orders/:orderId/history
// @Summary Get order history
// @Description Get the state change history of an order
// @Tags orders
// @Security Bearer
// @Param orderId path string true "Order ID"
// @Success 200 {object} object "Order history"
// @Router /orders/{orderId}/history [get]
func (h *OrderHandler) GetOrderHistory(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errors.ErrValidation.WithDetails(map[string]interface{}{
			"field": "orderId",
			"issue": "invalid UUID format",
		}))
		return
	}

	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	role, err := middleware.GetRole(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.ErrUnauthorized)
		return
	}

	history, err := h.service.GetOrderHistory(c.Request.Context(), orderID, userID, role)
	if err != nil {
		if appErr, isAppErr := err.(*errors.AppError); isAppErr {
			c.JSON(appErr.HTTPStatus, appErr)
			return
		}
		appErr := errors.ErrInternal
		appErr.Message = err.Error()
		c.JSON(appErr.HTTPStatus, appErr)
		return
	}

	responses := make([]dto.OrderHistoryResponse, len(history))
	for i, h := range history {
		fromEstado := ""
		if h.FromEstado != nil {
			fromEstado = string(*h.FromEstado)
		}
		responses[i] = dto.OrderHistoryResponse{
			ID:         h.ID,
			FromEstado: &fromEstado,
			ToEstado:   string(h.ToEstado),
			ChangedBy:  h.ChangedBy,
			CreatedAt:  h.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"orderId": orderID,
		"history": responses,
	})
}
