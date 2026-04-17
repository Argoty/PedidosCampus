package handler

import (
	"github.com/PedidosCampus/order-service/internal/dto"
	"github.com/PedidosCampus/order-service/internal/model"
)

// mapPedidoToResponse converts a Pedido model to OrderResponse DTO
func mapPedidoToResponse(pedido *model.Pedido) dto.OrderResponse {
	resp := dto.OrderResponse{
		ID:               pedido.ID,
		UserID:           pedido.UserID,
		RestauranteID:    pedido.RestauranteID,
		RepartidorID:     pedido.RepartidorID,
		Estado:           string(pedido.Estado),
		Subtotal:         pedido.Subtotal,
		CostoEntrega:     pedido.CostoEntrega,
		Total:            pedido.Total,
		DireccionEntrega: pedido.DireccionEntrega,
		CreatedAt:        pedido.CreatedAt,
		UpdatedAt:        pedido.UpdatedAt,
	}

	// Map items
	if len(pedido.Items) > 0 {
		resp.Items = make([]dto.OrderItemResponse, len(pedido.Items))
		for i, item := range pedido.Items {
			resp.Items[i] = dto.OrderItemResponse{
				ID:         item.ID,
				ProductID:  item.ProductID,
				Nombre:     item.Nombre,
				PrecioUnit: item.PrecioUnit,
				Cantidad:   item.Cantidad,
				Subtotal:   item.Subtotal,
			}
		}
	}

	// Map historial
	if len(pedido.Historial) > 0 {
		resp.Historial = make([]dto.OrderHistoryResponse, len(pedido.Historial))
		for i, h := range pedido.Historial {
			fromEstado := ""
			if h.FromEstado != nil {
				fromEstado = string(*h.FromEstado)
			}
			resp.Historial[i] = dto.OrderHistoryResponse{
				ID:         h.ID,
				FromEstado: &fromEstado,
				ToEstado:   string(h.ToEstado),
				ChangedBy:  h.ChangedBy,
				CreatedAt:  h.CreatedAt,
			}
		}
	}

	return resp
}
