package rabbitmq

import (
	"context"
	"encoding/json"
	"log"

	"github.com/streadway/amqp"
)

// Event types
type OrderCreatedEvent struct {
	EventID       string  `json:"eventId"`
	EventType     string  `json:"eventType"`
	OrderID       string  `json:"orderId"`
	UserID        string  `json:"userId"`
	RestauranteID string  `json:"restauranteId"`
	Subtotal      float64 `json:"subtotal"`
	CostoEntrega  float64 `json:"costoEntrega"`
	Total         float64 `json:"total"`
	Estado        string  `json:"estado"`
	CreatedAt     string  `json:"createdAt"`
}

type OrderAssignedEvent struct {
	EventID      string `json:"eventId"`
	EventType    string `json:"eventType"`
	OrderID      string `json:"orderId"`
	RepartidorID string `json:"repartidorId"`
	Estado       string `json:"estado"`
	Timestamp    string `json:"timestamp"`
}

type OrderStatusChangedEvent struct {
	EventID    string `json:"eventId"`
	EventType  string `json:"eventType"`
	OrderID    string `json:"orderId"`
	FromEstado string `json:"fromEstado"`
	ToEstado   string `json:"toEstado"`
	ChangedBy  string `json:"changedBy"`
	Estado     string `json:"estado"`
	Timestamp  string `json:"timestamp"`
}

type OrderDeliveredEvent struct {
	EventID       string `json:"eventId"`
	EventType     string `json:"eventType"`
	OrderID       string `json:"orderId"`
	UserID        string `json:"userId"`
	RepartidorID  string `json:"repartidorId"`
	RestauranteID string `json:"restauranteId"`
	DeliveredAt   string `json:"deliveredAt"`
}

type OrderCancelledEvent struct {
	EventID      string `json:"eventId"`
	EventType    string `json:"eventType"`
	OrderID      string `json:"orderId"`
	CancelledBy  string `json:"cancelledBy"`
	RevertedFrom string `json:"revertedFrom"`
}

// EventPublisher defines methods to publish events
type EventPublisher interface {
	PublishOrderCreated(ctx context.Context, event OrderCreatedEvent) error
	PublishOrderAssigned(ctx context.Context, event OrderAssignedEvent) error
	PublishOrderStatusChanged(ctx context.Context, event OrderStatusChangedEvent) error
	PublishOrderDelivered(ctx context.Context, event OrderDeliveredEvent) error
	PublishOrderCancelled(ctx context.Context, event OrderCancelledEvent) error
	Close() error
}

// RabbitMQPublisher implements EventPublisher for RabbitMQ
type RabbitMQPublisher struct {
	conn     *amqp.Connection
	channel  *amqp.Channel
	exchange string
}

// NewRabbitMQPublisher creates a new RabbitMQ publisher
func NewRabbitMQPublisher(url, exchange string) (EventPublisher, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}

	// Declare exchange
	err = ch.ExchangeDeclare(
		exchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}

	return &RabbitMQPublisher{
		conn:     conn,
		channel:  ch,
		exchange: exchange,
	}, nil
}

// PublishOrderCreated publishes order.created event
func (p *RabbitMQPublisher) PublishOrderCreated(ctx context.Context, event OrderCreatedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return p.channel.Publish(p.exchange, "order.created", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// PublishOrderAssigned publishes order.assigned event
func (p *RabbitMQPublisher) PublishOrderAssigned(ctx context.Context, event OrderAssignedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return p.channel.Publish(p.exchange, "order.assigned", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// PublishOrderStatusChanged publishes order.status.changed event
func (p *RabbitMQPublisher) PublishOrderStatusChanged(ctx context.Context, event OrderStatusChangedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return p.channel.Publish(p.exchange, "order.status.changed", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// PublishOrderDelivered publishes order.delivered event
func (p *RabbitMQPublisher) PublishOrderDelivered(ctx context.Context, event OrderDeliveredEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return p.channel.Publish(p.exchange, "order.delivered", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// PublishOrderCancelled publishes order.cancelled event
func (p *RabbitMQPublisher) PublishOrderCancelled(ctx context.Context, event OrderCancelledEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return p.channel.Publish(p.exchange, "order.cancelled", false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// Close closes the connection
func (p *RabbitMQPublisher) Close() error {
	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}

// MockPublisher is a mock implementation for testing
type MockPublisher struct {
	PublishedEvents []interface{}
}

// NewMockPublisher creates a new mock publisher
func NewMockPublisher() *MockPublisher {
	return &MockPublisher{
		PublishedEvents: make([]interface{}, 0),
	}
}

// PublishOrderCreated mock
func (m *MockPublisher) PublishOrderCreated(ctx context.Context, event OrderCreatedEvent) error {
	m.PublishedEvents = append(m.PublishedEvents, event)
	log.Printf("[MOCK] Published order.created: %s\n", event.OrderID)
	return nil
}

// PublishOrderAssigned mock
func (m *MockPublisher) PublishOrderAssigned(ctx context.Context, event OrderAssignedEvent) error {
	m.PublishedEvents = append(m.PublishedEvents, event)
	log.Printf("[MOCK] Published order.assigned: %s\n", event.OrderID)
	return nil
}

// PublishOrderStatusChanged mock
func (m *MockPublisher) PublishOrderStatusChanged(ctx context.Context, event OrderStatusChangedEvent) error {
	m.PublishedEvents = append(m.PublishedEvents, event)
	log.Printf("[MOCK] Published order.status.changed: %s -> %s\n", event.FromEstado, event.ToEstado)
	return nil
}

// PublishOrderDelivered mock
func (m *MockPublisher) PublishOrderDelivered(ctx context.Context, event OrderDeliveredEvent) error {
	m.PublishedEvents = append(m.PublishedEvents, event)
	log.Printf("[MOCK] Published order.delivered: %s\n", event.OrderID)
	return nil
}

// PublishOrderCancelled mock
func (m *MockPublisher) PublishOrderCancelled(ctx context.Context, event OrderCancelledEvent) error {
	m.PublishedEvents = append(m.PublishedEvents, event)
	log.Printf("[MOCK] Published order.cancelled: %s\n", event.OrderID)
	return nil
}

// Close mock
func (m *MockPublisher) Close() error {
	return nil
}
