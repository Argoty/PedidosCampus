package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config holds application configuration
type Config struct {
	Server        ServerConfig
	Database      DatabaseConfig
	JWT           JWTConfig
	RabbitMQ      RabbitMQConfig
	UserService   ServiceConfig
	RestService   ServiceConfig
	NotifService  ServiceConfig
	ServiceToken  string
	DeliveryCost  float64
	LogLevel      string
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Port int
	Env  string
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	URL      string
	LogLevel logger.LogLevel
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret string
}

// RabbitMQConfig holds RabbitMQ configuration
type RabbitMQConfig struct {
	URL         string
	Exchange    string
	QueuePrefix string
}

// ServiceConfig holds external service configuration
type ServiceConfig struct {
	URL     string
	Timeout time.Duration
}

// LoadConfig loads configuration from environment
func LoadConfig() (*Config, error) {
	// Load .env file if exists (for local development)
	_ = godotenv.Load(".env")

	cfg := &Config{
		Server: ServerConfig{
			Port: getEnvInt("SERVER_PORT", 8002),
			Env:  getEnv("SERVER_ENV", "development"),
		},
		Database: DatabaseConfig{
			URL:      getEnv("DATABASE_URL", ""),
			LogLevel: parseLogLevel(getEnv("DATABASE_LOG_LEVEL", "info")),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		},
		RabbitMQ: RabbitMQConfig{
			URL:         getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
			Exchange:    getEnv("RABBITMQ_EXCHANGE", "orders"),
			QueuePrefix: getEnv("RABBITMQ_QUEUE_PREFIX", "order-service"),
		},
		UserService: ServiceConfig{
			URL:     getEnv("USER_SERVICE_URL", "http://localhost:5000"),
			Timeout: parseDuration(getEnv("USER_SERVICE_TIMEOUT", "5s")),
		},
		RestService: ServiceConfig{
			URL:     getEnv("RESTAURANT_SERVICE_URL", "http://localhost:3002"),
			Timeout: parseDuration(getEnv("RESTAURANT_SERVICE_TIMEOUT", "5s")),
		},
NotifService: ServiceConfig{
			URL:     getEnv("NOTIFICACIONES_SERVICE_URL", "http://localhost:8787"),
			Timeout: parseDuration(getEnv("NOTIFICACIONES_SERVICE_TIMEOUT", "5s")),
		},
		ServiceToken: getEnv("SERVICE_TOKEN", ""),
		DeliveryCost: getEnvFloat("DELIVERY_COST", 200),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
	}

	// Validate required fields
	if cfg.Database.URL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

// ConnectDB connects to PostgreSQL database
func (cfg *DatabaseConfig) ConnectDB() (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.URL), &gorm.Config{
		Logger: logger.Default.LogMode(cfg.LogLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	return db, nil
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return value
	}
	return defaultValue
}

func parseDuration(value string) time.Duration {
	if duration, err := time.ParseDuration(value); err == nil {
		return duration
	}
	return 5 * time.Second
}

func parseLogLevel(level string) logger.LogLevel {
	switch level {
	case "silent":
		return logger.Silent
	case "error":
		return logger.Error
	case "warn":
		return logger.Warn
	case "info":
		return logger.Info
	default:
		return logger.Info
	}
}
