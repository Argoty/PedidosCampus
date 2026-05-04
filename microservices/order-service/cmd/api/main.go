package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/PedidosCampus/order-service/internal/config"
	"github.com/PedidosCampus/order-service/internal/handler"
	"github.com/PedidosCampus/order-service/internal/middleware"
	"github.com/PedidosCampus/order-service/internal/model"
	"github.com/PedidosCampus/order-service/internal/repository"
	"github.com/PedidosCampus/order-service/internal/service"
	"github.com/PedidosCampus/order-service/pkg/rabbitmq"
	"github.com/gin-gonic/gin"
)

// @title Order Service API
// @version 1.0
// @description Microservicio de Pedidos para PedidosCampus
// @host localhost:8002
// @BasePath /
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description "JWT Bearer token"
func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := cfg.Database.ConnectDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&model.Pedido{}, &model.PedidoItem{}, &model.PedidoEstadoLog{}); err != nil {
		log.Fatalf("Failed to migrate models: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	// Initialize RabbitMQ publisher (mock for local development)
	var publisher rabbitmq.EventPublisher
	if cfg.RabbitMQ.URL != "" {
		// Try to connect to RabbitMQ, but use mock if unavailable
		realPublisher, err := rabbitmq.NewRabbitMQPublisher(cfg.RabbitMQ.URL, cfg.RabbitMQ.Exchange)
		if err != nil {
			log.Printf("⚠️  Failed to connect to RabbitMQ, using mock publisher: %v", err)
			publisher = rabbitmq.NewMockPublisher()
		} else {
			publisher = realPublisher
			defer realPublisher.Close()
		}
	} else {
		log.Println("⚠️  RabbitMQ URL not configured, using mock publisher")
		publisher = rabbitmq.NewMockPublisher()
	}

	// Initialize layers
	orderRepo := repository.NewGORMOrderRepository(db)
	orderService := service.NewOrderService(orderRepo, publisher, cfg.DeliveryCost, cfg)
	orderHandler := handler.NewOrderHandler(orderService)

	// Setup Gin engine
	// Map environment names to Gin modes (Gin only accepts: debug, release, test)
	ginMode := cfg.Server.Env
	if ginMode == "development" {
		ginMode = gin.DebugMode
	} else if ginMode == "production" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)
	engine := gin.New()

	// Middleware
	engine.Use(gin.Recovery())
	engine.Use(middleware.ErrorHandlingMiddleware())
	engine.Use(func(c *gin.Context) {
		// Use cfg.ServiceToken which was loaded at startup, not os.Getenv which may not work correctly
		if c.Request.Method != "OPTIONS" && c.GetHeader("x-service-token") != cfg.ServiceToken {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		c.Next()
	})

	// Routes without authentication
	health := engine.Group("/health")
	{
		health.GET("", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
	}

	// Protected routes (require JWT)
	protected := engine.Group("/orders")
	protected.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	{
		// Create order (usuario)
		protected.POST("", middleware.RequireRole("usuario"), orderHandler.CreateOrder)

		// Get order (usuario, repartidor, admin)
		protected.GET("/:orderId", orderHandler.GetOrder)

		// Get order history
		protected.GET("/:orderId/history", orderHandler.GetOrderHistory)

		// List orders (usuario sees own, admin sees all)
		protected.GET("", orderHandler.ListOrders)

		// Accept order (repartidor)
		protected.POST("/:orderId/accept", middleware.RequireRole("repartidor"), orderHandler.AcceptOrder)

		// Update status (repartidor, admin)
		protected.POST("/:orderId/status", middleware.RequireRole("repartidor", "admin"), orderHandler.UpdateOrderStatus)

		// Cancel order (usuario, admin)
		protected.POST("/:orderId/cancel", orderHandler.CancelOrder)

		// List active orders (admin only)
		protected.GET("/active", middleware.RequireRole("admin"), orderHandler.ListActiveOrders)

		// List available orders (for repartidor)
		protected.GET("/available", middleware.RequireRole("repartidor", "admin"), orderHandler.ListAvailableOrders)

		// List deliverer orders
		protected.GET("/deliverer/:repartidorId", orderHandler.ListDelivererOrders)
	}

	// Start server
	log.Printf("🚀 Order Service starting on port %d\n", cfg.Server.Port)
	if err := engine.Run(":" + fmt.Sprintf("%d", cfg.Server.Port)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}