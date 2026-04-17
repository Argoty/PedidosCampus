package errors

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrorCode represents the error code
type ErrorCode string

const (
	ValidationError        ErrorCode = "VALIDATION_ERROR"
	InvalidStateTransition ErrorCode = "INVALID_STATE_TRANSITION"
	Unauthorized           ErrorCode = "UNAUTHORIZED"
	Forbidden              ErrorCode = "FORBIDDEN"
	NotFound               ErrorCode = "NOT_FOUND"
	Conflict               ErrorCode = "CONFLICT"
	InternalError          ErrorCode = "INTERNAL_ERROR"
)

// AppError represents an application error
type AppError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	RequestID  string                 `json:"requestId"`
	HTTPStatus int                    `json:"-"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	return e.Message
}

// NewAppError creates a new application error
func NewAppError(code ErrorCode, message string, httpStatus int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		Timestamp:  time.Now().UTC(),
		RequestID:  uuid.New().String(),
		HTTPStatus: httpStatus,
	}
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}

// Predefined errors
var (
	ErrValidation             = NewAppError(ValidationError, "Validation failed", 400)
	ErrUnauthorized           = NewAppError(Unauthorized, "Unauthorized access", 401)
	ErrForbidden              = NewAppError(Forbidden, "Access forbidden", 403)
	ErrNotFound               = NewAppError(NotFound, "Resource not found", 404)
	ErrConflict               = NewAppError(Conflict, "Conflict in resource state", 409)
	ErrInternal               = NewAppError(InternalError, "Internal server error", 500)
	ErrInvalidStateTransition = NewAppError(InvalidStateTransition, "Invalid state transition", 400)
	ErrOrderNotPending        = NewAppError(Conflict, "Order is not in pending state", 409)
	ErrOrderNotFound          = NewAppError(NotFound, "Order not found", 404)
	ErrItemsEmpty             = NewAppError(ValidationError, "Items cannot be empty", 400)
	ErrInvalidToken           = NewAppError(Unauthorized, "Invalid or expired token", 401)
	ErrMissingToken           = NewAppError(Unauthorized, "Missing authorization token", 401)
)

// IsAppError checks if an error is an AppError
func IsAppError(err error) bool {
	var appErr *AppError
	return errors.As(err, &appErr)
}

// AsAppError converts an error to AppError
func AsAppError(err error) *AppError {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return ErrInternal
}
