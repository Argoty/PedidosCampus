package repository

import (
	"context"
	"time"

	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/PedidosCampus/order-service/pkg/errors"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GORMOrderRepository implements OrderRepository using GORM
type GORMOrderRepository struct {
	db *gorm.DB
}

// NewGORMOrderRepository creates a new GORM-based order repository
func NewGORMOrderRepository(db *gorm.DB) OrderRepository {
	return &GORMOrderRepository{db: db}
}

// CreateOrder creates a new order with items and initial state log in a transaction
func (r *GORMOrderRepository) CreateOrder(ctx context.Context, pedido *model.Pedido, items []model.PedidoItem, stateLog model.PedidoEstadoLog) (*model.Pedido, error) {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create pedido
	if err := tx.Create(pedido).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Create items
	for i := range items {
		items[i].PedidoID = pedido.ID
		if err := tx.Create(&items[i]).Error; err != nil {
			tx.Rollback()
			return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
				"error": err.Error(),
			})
		}
	}

	// Create state log
	stateLog.PedidoID = pedido.ID
	if err := tx.Create(&stateLog).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Reload pedido with associations
	if err := r.db.WithContext(ctx).Preload("Items").Preload("Historial").First(pedido).Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return pedido, nil
}

// GetOrderByID retrieves an order with all related data
func (r *GORMOrderRepository) GetOrderByID(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	var pedido model.Pedido
	err := r.db.WithContext(ctx).
		Preload("Items").
		Preload("Historial").
		First(&pedido, "id = ?", orderID).Error

	if err == gorm.ErrRecordNotFound {
		return nil, errors.ErrOrderNotFound
	}
	if err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return &pedido, nil
}

// ListOrdersByUser retrieves orders for a specific user
func (r *GORMOrderRepository) ListOrdersByUser(ctx context.Context, userID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error) {
	var pedidos []model.Pedido
	var total int64

	query := r.db.WithContext(ctx).Where("user_id = ?", userID)

	if estado != "" {
		query = query.Where("estado = ?", estado)
	}

	// Count total
	if err := query.Model(&model.Pedido{}).Count(&total).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Fetch paginated results
	if err := query.
		Preload("Items").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&pedidos).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return pedidos, total, nil
}

// ListActiveOrders retrieves all active orders
func (r *GORMOrderRepository) ListActiveOrders(ctx context.Context, limit, offset int, estado, restauranteID, repartidorID string) ([]model.Pedido, int64, error) {
	var pedidos []model.Pedido
	var total int64

	query := r.db.WithContext(ctx).Where("estado NOT IN ?", []string{"entregado", "cancelado"})

	if estado != "" {
		query = query.Where("estado = ?", estado)
	}
	if restauranteID != "" {
		query = query.Where("restaurante_id = ?", restauranteID)
	}
	if repartidorID != "" {
		query = query.Where("repartidor_id = ?", repartidorID)
	}

	// Count total
	if err := query.Model(&model.Pedido{}).Count(&total).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Fetch paginated results
	if err := query.
		Preload("Items").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&pedidos).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return pedidos, total, nil
}

// ListOrdersByDeliverer retrieves orders assigned to a specific deliverer
func (r *GORMOrderRepository) ListOrdersByDeliverer(ctx context.Context, repartidorID uuid.UUID, limit, offset int, estado string) ([]model.Pedido, int64, error) {
	var pedidos []model.Pedido
	var total int64

	query := r.db.WithContext(ctx).Where("repartidor_id = ?", repartidorID)

	if estado != "" {
		query = query.Where("estado = ?", estado)
	}

	// Count total
	if err := query.Model(&model.Pedido{}).Count(&total).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Fetch paginated results
	if err := query.
		Preload("Items").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&pedidos).Error; err != nil {
		return nil, 0, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return pedidos, total, nil
}

// UpdateOrderStatus updates the order status and creates a state log entry
func (r *GORMOrderRepository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, newEstado model.EstadoPedido, changedBy *uuid.UUID) (*model.Pedido, error) {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var pedido model.Pedido
	if err := tx.First(&pedido, "id = ?", orderID).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrOrderNotFound
		}
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Validate transition
	if !pedido.IsValidTransition(newEstado) {
		tx.Rollback()
		return nil, errors.ErrInvalidStateTransition.WithDetails(map[string]interface{}{
			"current": string(pedido.Estado),
			"next":    string(newEstado),
		})
	}

	// Update status
	if err := tx.Model(&pedido).Update("estado", newEstado).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Create state log
	stateLog := model.PedidoEstadoLog{
		ID:         uuid.New(),
		PedidoID:   orderID,
		FromEstado: &pedido.Estado,
		ToEstado:   newEstado,
		ChangedBy:  changedBy,
	}

	if err := tx.Create(&stateLog).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Reload with associations
	if err := r.db.WithContext(ctx).Preload("Items").Preload("Historial").First(&pedido).Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return &pedido, nil
}

// AcceptOrder assigns a deliverer and changes status to aceptado
func (r *GORMOrderRepository) AcceptOrder(ctx context.Context, orderID, repartidorID uuid.UUID) (*model.Pedido, error) {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var pedido model.Pedido
	if err := tx.First(&pedido, "id = ?", orderID).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrOrderNotFound
		}
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if pedido.Estado != model.EstadoPendiente {
		tx.Rollback()
		return nil, errors.ErrOrderNotPending
	}

	// Update deliverer and status
	if err := tx.Model(&pedido).Updates(map[string]interface{}{
		"repartidor_id": repartidorID,
		"estado":        model.EstadoAceptado,
	}).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Create state log
	stateLog := model.PedidoEstadoLog{
		ID:         uuid.New(),
		PedidoID:   orderID,
		FromEstado: &pedido.Estado,
		ToEstado:   model.EstadoAceptado,
		ChangedBy:  &repartidorID,
	}

	if err := tx.Create(&stateLog).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Reload with associations
	if err := r.db.WithContext(ctx).Preload("Items").Preload("Historial").First(&pedido).Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return &pedido, nil
}

// CancelOrder cancels an order (only if pendiente)
func (r *GORMOrderRepository) CancelOrder(ctx context.Context, orderID uuid.UUID) (*model.Pedido, error) {
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var pedido model.Pedido
	if err := tx.First(&pedido, "id = ?", orderID).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrOrderNotFound
		}
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if !pedido.IsCancellable() {
		tx.Rollback()
		err := errors.NewAppError(errors.Conflict, "Order cannot be cancelled", 409)
		return nil, err.WithDetails(map[string]interface{}{
			"current_state": string(pedido.Estado),
		})
	}

	// Update status to cancelado and set cancelled timestamp
	now := time.Now()
	if err := tx.Model(&pedido).Updates(map[string]interface{}{
		"estado":       model.EstadoCancelado,
		"cancelled_at": now,
	}).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Create state log
	stateLog := model.PedidoEstadoLog{
		ID:         uuid.New(),
		PedidoID:   orderID,
		FromEstado: &pedido.Estado,
		ToEstado:   model.EstadoCancelado,
	}

	if err := tx.Create(&stateLog).Error; err != nil {
		tx.Rollback()
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	// Reload with associations
	if err := r.db.WithContext(ctx).Preload("Items").Preload("Historial").First(&pedido).Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return &pedido, nil
}

// GetOrderHistory retrieves all state changes for an order
func (r *GORMOrderRepository) GetOrderHistory(ctx context.Context, orderID uuid.UUID) ([]model.PedidoEstadoLog, error) {
	var history []model.PedidoEstadoLog
	if err := r.db.WithContext(ctx).
		Where("pedido_id = ?", orderID).
		Order("created_at ASC").
		Find(&history).Error; err != nil {
		return nil, errors.ErrInternal.WithDetails(map[string]interface{}{
			"error": err.Error(),
		})
	}

	return history, nil
}
