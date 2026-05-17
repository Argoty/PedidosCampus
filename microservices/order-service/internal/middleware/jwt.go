package middleware

import (
    "encoding/base64"
    "encoding/json"
    "log"
    "strings"

    "github.com/golang-jwt/jwt/v5"
    "github.com/PedidosCampus/order-service/pkg/errors"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

const (
	UserIDKey = "userId"
	RoleKey   = "role"
	SubKey    = "sub"
)

// Claims represents JWT claims
type Claims struct {
	Sub   string `json:"sub"` // user ID
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// JWTMiddleware extracts claims without verifying signature
func JWTMiddleware(_ string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(errors.ErrMissingToken.HTTPStatus, errors.ErrMissingToken)
            c.Abort()
            return
        }

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(errors.ErrInvalidToken.HTTPStatus, errors.ErrInvalidToken)
			c.Abort()
			return
		}

        tokenString := parts[1]

        claims := &Claims{}
        payload, err := decodeJWTPayload(tokenString)
        if err != nil {
            c.JSON(errors.ErrInvalidToken.HTTPStatus, errors.ErrInvalidToken)
            c.Abort()
            return
        }
        if err := json.Unmarshal(payload, claims); err != nil {
            c.JSON(errors.ErrInvalidToken.HTTPStatus, errors.ErrInvalidToken)
            c.Abort()
            return
        }

		// Store claims in context
		c.Set(SubKey, claims.Sub)
		c.Set(RoleKey, claims.Role)
		c.Set(UserIDKey, claims.Sub)

		// Debug logs for claims
		// NOTE: remove or lower verbosity in production
        log.Printf("[JWTMiddleware] claims sub=%s role=%s email=%s", claims.Sub, claims.Role, claims.Email)

		c.Next()
	}
}

func decodeJWTPayload(tokenString string) ([]byte, error) {
    parts := strings.Split(tokenString, ".")
    if len(parts) != 3 {
        return nil, errors.ErrInvalidToken
    }

    payloadSegment := parts[1]
    payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadSegment)
    if err != nil {
        return nil, errors.ErrInvalidToken
    }

    return payloadBytes, nil
}

// RequireRole middleware checks if user has the required role
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(RoleKey)
		if !exists {
			c.JSON(errors.ErrForbidden.HTTPStatus, errors.ErrForbidden)
			c.Abort()
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			c.JSON(errors.ErrForbidden.HTTPStatus, errors.ErrForbidden)
			c.Abort()
			return
		}

		// Check if role is allowed
		allowed := false
		for _, r := range allowedRoles {
			if roleStr == r {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(errors.ErrForbidden.HTTPStatus, errors.ErrForbidden)
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, error) {
	userID, exists := c.Get(UserIDKey)
	if !exists {
		return uuid.Nil, errors.ErrUnauthorized
	}

	userIDStr, ok := userID.(string)
	if !ok {
		return uuid.Nil, errors.ErrUnauthorized
	}

	return uuid.Parse(userIDStr)
}

// GetRole extracts role from context
func GetRole(c *gin.Context) (string, error) {
	role, exists := c.Get(RoleKey)
	if !exists {
		return "", errors.ErrUnauthorized
	}

	roleStr, ok := role.(string)
	if !ok {
		return "", errors.ErrUnauthorized
	}

	return roleStr, nil
}

// ErrorHandlingMiddleware handles panics and converts them to proper HTTP responses
func ErrorHandlingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				if err, ok := r.(error); ok {
					if appErr, isAppErr := r.(*errors.AppError); isAppErr {
						c.JSON(appErr.HTTPStatus, appErr)
						return
					}
					appErr := errors.ErrInternal
					appErr.Message = err.Error()
					c.JSON(appErr.HTTPStatus, appErr)
					return
				}
			}
		}()
		c.Next()
	}
}
