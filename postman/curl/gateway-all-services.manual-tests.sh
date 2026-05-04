#!/usr/bin/env bash
set -euo pipefail

# Complete API Gateway Tests - All Services
# This script tests all endpoints through the API Gateway (port 3000)
#
# Usage:
#   chmod +x postman/curl/gateway-all-services.manual-tests.sh
#   postman/curl/gateway-all-services.manual-tests.sh
#
# Optional env vars:
#   BASE_URL=http://localhost:3000
#   ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret
#   SERVICE_TOKEN=internal_super_secret_token_123

BASE_URL="${BASE_URL:-http://localhost:3000}"
ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-dev_access_token_secret_123_very_secret}"
SERVICE_TOKEN="${SERVICE_TOKEN:-internal_super_secret_token_123}"

echo "==============================================="
echo "Complete API Gateway Tests"
echo "BASE_URL: $BASE_URL"
echo "==============================================="

# ============================================
# Helper Functions
# ============================================

json_pretty() {
	local file="$1"
	python3 - "$file" <<'PY'
import json,sys
raw=open(sys.argv[1], 'r', encoding='utf-8', errors='replace').read().strip()
if not raw:
    print('(empty body)')
else:
    try:
        print(json.dumps(json.loads(raw), ensure_ascii=False, indent=2))
    except Exception:
        print(raw)
PY
}

request() {
	local name="$1"
	shift
	local tmp
	tmp="$(mktemp)"
	local code
	code="$(curl -sS -o "$tmp" -w "%{http_code}" "$@")"
	echo
	echo "=== $name ==="
	echo "HTTP $code"
	json_pretty "$tmp"
	rm -f "$tmp"
}

make_jwt() {
	local sub="$1"
	local role="$2"
	python3 - "$ACCESS_TOKEN_SECRET" "$sub" "$role" <<'PY'
import base64, json, hmac, hashlib, time, sys
secret=sys.argv[1].encode()
sub=sys.argv[2]
role=sys.argv[3]
now=int(time.time())
header={"alg":"HS256","typ":"JWT"}
payload={
  "sub":sub,
  "email":f"{role}@pedidoscampus.local",
  "role":role,
  "type":"access",
  "jti":f"test-{role}-{now}",
  "iat":now,
  "exp":now + 180*24*3600
}
enc=lambda o: base64.urlsafe_b64encode(json.dumps(o,separators=(',',':')).encode()).rstrip(b'=')
h=enc(header); p=enc(payload)
s=base64.urlsafe_b64encode(hmac.new(secret,h+b'.'+p,hashlib.sha256).digest()).rstrip(b'=')
print((h+b'.'+p+b'.'+s).decode())
PY
}

extract_field() {
	local json_text="$1"
	local field="$2"
	python3 - "$json_text" "$field" <<'PY'
import json,sys
txt=sys.argv[1].strip()
field=sys.argv[2]
if not txt:
    print('')
    raise SystemExit
try:
    d=json.loads(txt)
    v=d.get(field, '') if isinstance(d, dict) else ''
    print(v if v is not None else '')
except Exception:
    print('')
PY
}

# ============================================
# Generate Tokens
# ============================================

echo
echo "--- Generating JWT tokens ---"
USUARIO_SUB="550e8400-e29b-41d4-a716-446655440000"
REPARTIDOR_SUB="550e8400-e29b-41d4-a716-446655440001"
ADMIN_SUB="550e8400-e29b-41d4-a716-446655440002"

TOK_USR="$(make_jwt "$USUARIO_SUB" "usuario")"
TOK_REP="$(make_jwt "$REPARTIDOR_SUB" "repartidor")"
TOK_ADM="$(make_jwt "$ADMIN_SUB" "admin")"

echo "Tokens generated:"
echo "  usuario: ${TOK_USR:0:50}..."
echo "  repartidor: ${TOK_REP:0:50}..."
echo "  admin: ${TOK_ADM:0:50}..."

# ============================================
# AUTH SERVICE TESTS (/auth/*)
# ============================================

echo
echo "==============================================="
echo "AUTH SERVICE TESTS"
echo "==============================================="

# Register new user
echo
echo "--- POST /auth/register ---"
REGISTER_RESP=$(curl -sS -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"nombre": "Test Usuario",
		"email": "testuser-'"$(date +%s)"'@example.com",
		"password": "123456",
		"telefono": "+573001234567",
		"direccion": "Calle Test 123",
		"role": "usuario"
	}')
echo "$REGISTER_RESP" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESP"

# Login
echo
echo "--- POST /auth/login ---"
LOGIN_RESP=$(curl -sS -X POST "$BASE_URL/auth/login" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"email": "testuser@example.com",
		"password": "123456"
	}')
echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"

# Me (with our generated token)
echo
echo "--- GET /auth/me (usuario) ---"
request "GET /auth/me" \
	-X GET "$BASE_URL/auth/me" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Admin ping
echo
echo "--- GET /auth/admin/ping (admin) ---"
request "GET /auth/admin/ping" \
	-X GET "$BASE_URL/auth/admin/ping" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# Me with repartidor
echo
echo "--- GET /auth/me (repartidor) ---"
request "GET /auth/me (repartidor)" \
	-X GET "$BASE_URL/auth/me" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "x-service-token: $SERVICE_TOKEN"

# Test without service token
echo
echo "--- POST /auth/register without x-service-token ---"
request "No service token" \
	-X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"Fail","email":"fail@test.com","password":"123456"}'

# ============================================
# USER SERVICE TESTS (/api/profiles/*)
# ============================================

echo
echo "==============================================="
echo "USER SERVICE TESTS"
echo "==============================================="
echo "Testing through API Gateway"

# Create profile (usuario) - via gateway
echo
echo "--- POST /api/profiles (usuario) ---"
request "Create profile" \
	-X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"tipo":"usuario","nombre":"Juan Pérez","telefono":"+34912345678","direccion":"Calle 123"}'

# Get my profile
echo
echo "--- GET /api/profiles/me ---"
request "Get my profile" \
	-X GET "$BASE_URL/api/profiles/me" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Update profile
echo
echo "--- PATCH /api/profiles/me ---"
request "Update profile" \
	-X PATCH "$BASE_URL/api/profiles/me" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Juan Pérez Actualizado"}'

# Create repartidor profile
echo
echo "--- POST /api/profiles (repartidor) ---"
request "Create repartidor profile" \
	-X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"tipo":"repartidor","nombre":"Repartidor Test","telefono":"+573004445566"}'

# Get availability
echo
echo "--- GET /api/profiles/me/availability (repartidor) ---"
request "Get availability" \
	-X GET "$BASE_URL/api/profiles/me/availability" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "x-service-token: $SERVICE_TOKEN"

# Set availability
echo
echo "--- POST /api/profiles/me/availability ---"
request "Set availability" \
	-X POST "$BASE_URL/api/profiles/me/availability" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"disponible":true}'

# Admin: list profiles
echo
echo "--- GET /api/profiles (admin) ---"
request "List profiles (admin)" \
	-X GET "$BASE_URL/api/profiles?tipo=usuario&isActive=true&limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# Admin: get profile by ID (need to get ID first)
echo
echo "--- GET /api/profiles/{id} (admin) ---"
ME_RESP=$(curl -sS -X GET "$BASE_URL/api/profiles/me" -H "Authorization: Bearer $TOK_USR" -H "x-service-token: $SERVICE_TOKEN")
PROFILE_ID=$(extract_field "$ME_RESP" "id")
if [[ -n "$PROFILE_ID" ]]; then
	request "Get profile by ID" \
		-X GET "$BASE_URL/api/profiles/$PROFILE_ID" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-service-token: $SERVICE_TOKEN"
else
	echo "[SKIP] No profile ID available"
fi

# Admin: update profile
if [[ -n "$PROFILE_ID" ]]; then
	echo
	echo "--- PATCH /api/profiles/{id} (admin) ---"
	request "Update profile (admin)" \
		-X PATCH "$BASE_URL/api/profiles/$PROFILE_ID" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"nombre":"Updated by Admin"}'
fi

# Admin: activate/deactivate
if [[ -n "$PROFILE_ID" ]]; then
	echo
	echo "--- POST /api/profiles/{id}/activate (admin) ---"
	request "Activate profile" \
		-X POST "$BASE_URL/api/profiles/$PROFILE_ID/activate" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- POST /api/profiles/{id}/deactivate (admin) ---"
	request "Deactivate profile" \
		-X POST "$BASE_URL/api/profiles/$PROFILE_ID/deactivate" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-service-token: $SERVICE_TOKEN"
fi

# Internal endpoints (gateway) - via docker network, need x-client header
echo
echo "--- GET /api/profiles/delivery (internal) ---"
request "Get delivery profiles" \
	-X GET "$BASE_URL/api/profiles/delivery?onlyAvailable=true" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-client: gateway" \
	-H "x-service-token: $SERVICE_TOKEN"

echo
echo "--- GET /api/profiles/search (internal) ---"
request "Search profiles" \
	-X GET "$BASE_URL/api/profiles/search?tipo=repartidor&disponible=true" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-client: gateway" \
	-H "x-service-token: $SERVICE_TOKEN"

# ============================================
# RESTAURANT SERVICE TESTS (/restaurants/*)
# ============================================

echo
echo "==============================================="
echo "RESTAURANT SERVICE TESTS"
echo "==============================================="

# Health check
echo
echo "--- GET /health (restaurant-service) ---"
request "Health check" \
	-X GET "$BASE_URL/restaurants/health" \
	-H "x-service-token: $SERVICE_TOKEN"

# Create restaurant (admin only)
echo
echo "--- POST /restaurants (admin) ---"
CREATE_REST=$(curl -sS -X POST "$BASE_URL/restaurants" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Restaurante Test","descripcion":"Comida de prueba","direccion":"Calle 123","categoria":"Comida Rápida"}')

echo "$CREATE_REST" | python3 -m json.tool 2>/dev/null || echo "$CREATE_REST"
REST_ID=$(extract_field "$CREATE_REST" "id")
echo "Restaurant ID: ${REST_ID:-<none>}"

# List restaurants
echo
echo "--- GET /restaurants ---"
request "List restaurants" \
	-X GET "$BASE_URL/restaurants?is_active=true&limit=10&offset=0" \
	-H "x-service-token: $SERVICE_TOKEN"

# Get restaurant by ID
if [[ -n "$REST_ID" ]]; then
	echo
	echo "--- GET /restaurants/{id} ---"
	request "Get restaurant by ID" \
		-X GET "$BASE_URL/restaurants/$REST_ID" \
		-H "x-service-token: $SERVICE_TOKEN"

	# Update restaurant
	echo
	echo "--- PATCH /restaurants/{id} ---"
	request "Update restaurant" \
		-X PATCH "$BASE_URL/restaurants/$REST_ID" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"descripcion":"Descripción actualizada"}'

	# Create product
	echo
	echo "--- POST /restaurants/{id}/products ---"
	CREATE_PROD=$(curl -sS -X POST "$BASE_URL/restaurants/$REST_ID/products" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"nombre":"Producto Test","descripcion":"Descripcion","precio":"5.50","disponible":true}')

	echo "$CREATE_PROD" | python3 -m json.tool 2>/dev/null || echo "$CREATE_PROD"
	PROD_ID=$(extract_field "$CREATE_PROD" "id")
	echo "Product ID: ${PROD_ID:-<none>}"

	# List products
	echo
	echo "--- GET /restaurants/{id}/products ---"
	request "List products" \
		-X GET "$BASE_URL/restaurants/$REST_ID/products" \
		-H "x-service-token: $SERVICE_TOKEN"

	# Get product by ID
	if [[ -n "$PROD_ID" ]]; then
		echo
		echo "--- GET /products/{id} ---"
		request "Get product by ID" \
			-X GET "$BASE_URL/restaurants/products/$PROD_ID" \
			-H "x-service-token: $SERVICE_TOKEN"

		# Update product
		echo
		echo "--- PATCH /products/{id} ---"
		request "Update product" \
			-X PATCH "$BASE_URL/restaurants/products/$PROD_ID" \
			-H "Authorization: Bearer $TOK_ADM" \
			-H "Content-Type: application/json" \
			-H "x-service-token: $SERVICE_TOKEN" \
			-d '{"precio":"6.00"}'

		# Validate batch
		echo
		echo "--- POST /products/validate-batch ---"
		request "Validate batch" \
			-X POST "$BASE_URL/restaurants/products/validate-batch" \
			-H "Content-Type: application/json" \
			-H "x-service-token: $SERVICE_TOKEN" \
			-d "{\"items\":[{\"producto_id\":\"$PROD_ID\",\"precio_unit\":\"6.00\"}]}"

		# Delete product
		echo
		echo "--- DELETE /products/{id} ---"
		request "Delete product" \
			-X DELETE "$BASE_URL/restaurants/products/$PROD_ID" \
			-H "Authorization: Bearer $TOK_ADM" \
			-H "x-service-token: $SERVICE_TOKEN"
	fi

	# Activate/Deactivate restaurant
	echo
	echo "--- POST /restaurants/{id}/deactivate ---"
	request "Deactivate restaurant" \
		-X POST "$BASE_URL/restaurants/$REST_ID/deactivate" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- POST /restaurants/{id}/activate ---"
	request "Activate restaurant" \
		-X POST "$BASE_URL/restaurants/$REST_ID/activate" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-service-token: $SERVICE_TOKEN"
fi

# Test without admin role
echo
echo "--- POST /restaurants without admin (403 expected) ---"
request "Create without admin" \
	-X POST "$BASE_URL/restaurants" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Fail","direccion":"Test","categoria":"Test"}'

# ============================================
# ORDER SERVICE TESTS (/orders/*)
# ============================================

echo
echo "==============================================="
echo "ORDER SERVICE TESTS"
echo "==============================================="

# Health check
echo
echo "--- GET /health (order-service) ---"
request "Health check" \
	-X GET "$BASE_URL/orders/health" \
	-H "x-service-token: $SERVICE_TOKEN"

# Create order (need real restaurant/product IDs, using mocks)
echo
echo "--- POST /orders (usuario) ---"
CREATE_ORDER=$(curl -sS -X POST "$BASE_URL/orders" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"restauranteId":"550e8400-e29b-41d4-a716-446655440000","direccionEntrega":"Calle 123","items":[{"productId":"550e8400-e29b-41d4-a716-446655440100","nombre":"Test Product","precioUnit":10.00,"cantidad":2}]}')

echo "$CREATE_ORDER" | python3 -m json.tool 2>/dev/null || echo "$CREATE_ORDER"
ORDER_ID=$(extract_field "$CREATE_ORDER" "id")
echo "Order ID: ${ORDER_ID:-<none>}"

# List orders
echo
echo "--- GET /orders (usuario) ---"
request "List orders" \
	-X GET "$BASE_URL/orders?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Get order by ID
if [[ -n "$ORDER_ID" ]]; then
	echo
	echo "--- GET /orders/{id} ---"
	request "Get order by ID" \
		-X GET "$BASE_URL/orders/$ORDER_ID" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "x-service-token: $SERVICE_TOKEN"

	# Get order history
	echo
	echo "--- GET /orders/{id}/history ---"
	request "Get order history" \
		-X GET "$BASE_URL/orders/$ORDER_ID/history" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "x-service-token: $SERVICE_TOKEN"

	# Accept order (repartidor)
	echo
	echo "--- POST /orders/{id}/accept ---"
	request "Accept order" \
		-X POST "$BASE_URL/orders/$ORDER_ID/accept" \
		-H "Authorization: Bearer $TOK_REP" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d "{\"repartidorId\":\"$REPARTIDOR_SUB\"}"

	# Update status to en_camino
	echo
	echo "--- POST /orders/{id}/status (en_camino) ---"
	request "Update status en_camino" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_REP" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"toEstado":"en_camino"}'

	# Update status to entregado (admin)
	echo
	echo "--- POST /orders/{id}/status (entregado) ---"
	request "Update status entregado" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"toEstado":"entregado"}'

	# Try to cancel (should fail - already delivered)
	echo
	echo "--- POST /orders/{id}/cancel (already delivered - expect 409) ---"
	request "Cancel delivered order" \
		-X POST "$BASE_URL/orders/$ORDER_ID/cancel" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"reason":"Test cancel"}'
fi

# List active orders (admin)
echo
echo "--- GET /orders/active (admin) ---"
request "List active orders" \
	-X GET "$BASE_URL/orders/active?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# List available orders (repartidor)
echo
echo "--- GET /orders/available (repartidor) ---"
request "List available orders" \
	-X GET "$BASE_URL/orders/available?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "x-service-token: $SERVICE_TOKEN"

# List orders by deliverer
echo
echo "--- GET /orders/deliverer/{id} (repartidor) ---"
request "List orders by deliverer" \
	-X GET "$BASE_URL/orders/deliverer/$REPARTIDOR_SUB?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "x-service-token: $SERVICE_TOKEN"

# Test without auth
echo
echo "--- GET /orders without auth (401 expected) ---"
request "List orders without auth" \
	-X GET "$BASE_URL/orders"

# ============================================
# RATING SERVICE TESTS (/ratings/*)
# ============================================

echo
echo "==============================================="
echo "RATING SERVICE TESTS"
echo "==============================================="

# Health check
echo
echo "--- GET /health (rating-service) ---"
request "Health check" \
	-X GET "$BASE_URL/ratings/health"

# Create restaurant rating
echo
echo "--- POST /ratings/restaurant ---"
CREATE_RATING=$(curl -sS -X POST "$BASE_URL/ratings/restaurant" \
	-H "Content-Type: application/json" \
	-d '{
		"pedido_id":"550e8400-e29b-41d4-a716-446655440001",
		"restaurante_id":"650e8400-e29b-41d4-a716-446655440001",
		"estrellas":5,
		"comentario":"Excelente comida"
	}')

echo "$CREATE_RATING" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RATING"
RATING_ID=$(extract_field "$CREATE_RATING" "id")
echo "Rating ID: ${RATING_ID:-<none>}"

# Get rating by ID
if [[ -n "$RATING_ID" ]]; then
	echo
	echo "--- GET /ratings/restaurant/{id} ---"
	request "Get rating by ID" \
		-X GET "$BASE_URL/ratings/restaurant/$RATING_ID"
fi

# List ratings by user
echo
echo "--- GET /ratings/restaurant/user/{id} ---"
request "List ratings by user" \
	-X GET "$BASE_URL/ratings/restaurant/user/450e8400-e29b-41d4-a716-446655440099?limit=10&offset=0"

# List ratings by restaurant
echo
echo "--- GET /ratings/restaurant/restaurant/{id} ---"
request "List ratings by restaurant" \
	-X GET "$BASE_URL/ratings/restaurant/restaurant/650e8400-e29b-41d4-a716-446655440001?limit=10&offset=0"

# Get stats
echo
echo "--- GET /ratings/stats/restaurant/{id} ---"
request "Get restaurant stats" \
	-X GET "$BASE_URL/ratings/stats/restaurant/650e8400-e29b-41d4-a716-446655440001"

# Update rating
if [[ -n "$RATING_ID" ]]; then
	echo
	echo "--- PATCH /ratings/restaurant/{id} ---"
	request "Update rating" \
		-X PATCH "$BASE_URL/ratings/restaurant/$RATING_ID" \
		-H "Content-Type: application/json" \
		-d '{"estrellas":4,"comentario":"Muy buena comida"}'
fi

# Create delivery rating
echo
echo "--- POST /ratings/delivery ---"
CREATE_DELIVERY_RATING=$(curl -sS -X POST "$BASE_URL/ratings/delivery" \
	-H "Content-Type: application/json" \
	-d '{
		"pedido_id":"550e8400-e29b-41d4-a716-440000",
		"repartidor_id":"750e8400-e29b-41d4-a716-446655440002",
		"estrellas":5,
		"comentario":"Entrega rápida"
	}')

echo "$CREATE_DELIVERY_RATING" | python3 -m json.tool 2>/dev/null || echo "$CREATE_DELIVERY_RATING"
DELIVERY_RATING_ID=$(extract_field "$CREATE_DELIVERY_RATING" "id")
echo "Delivery Rating ID: ${DELIVERY_RATING_ID:-<none>}"

# Get delivery rating by ID
if [[ -n "$DELIVERY_RATING_ID" ]]; then
	echo
	echo "--- GET /ratings/delivery/{id} ---"
	request "Get delivery rating by ID" \
		-X GET "$BASE_URL/ratings/delivery/$DELIVERY_RATING_ID"
fi

# List delivery ratings by delivery
echo
echo "--- GET /ratings/delivery/delivery/{id} ---"
request "List delivery ratings" \
	-X GET "$BASE_URL/ratings/delivery/delivery/750e8400-e29b-41d4-a716-446655440002?limit=10&offset=0"

# Get delivery stats
echo
echo "--- GET /ratings/stats/delivery/{id} ---"
request "Get delivery stats" \
	-X GET "$BASE_URL/ratings/stats/delivery/750e8400-e29b-41d4-a716-446655440002"

# Delete ratings
if [[ -n "$RATING_ID" ]]; then
	echo
	echo "--- DELETE /ratings/restaurant/{id} ---"
	request "Delete rating" \
		-X DELETE "$BASE_URL/ratings/restaurant/$RATING_ID"
fi

if [[ -n "$DELIVERY_RATING_ID" ]]; then
	echo
	echo "--- DELETE /ratings/delivery/{id} ---"
	request "Delete delivery rating" \
		-X DELETE "$BASE_URL/ratings/delivery/$DELIVERY_RATING_ID"
fi

echo
echo "==============================================="
echo "All API Gateway Tests Complete!"
echo "==============================================="