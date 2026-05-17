#!/usr/bin/env bash
set -euo pipefail

# ============================================
# PedidosCampus — Cloud Smoke Tests
# Target: https://pedidoscampus-gateway.onrender.com
# ============================================

BASE_URL="https://pedidoscampus-gateway.onrender.com"
SERVICE_TOKEN="svc_9Qm4Vx2Kp8Hc7Nw3Rj6Tb1Yf5Ld8Sa0Z"

# Write secret to file to avoid "argument list too long"
SECRET_FILE="$(mktemp)"
echo -n "4fN9xK2qL8mZ7vR3aP1wT6yJ0sD5hQ8eU9cB2nM7gX4kF1rA" > "$SECRET_FILE"

cleanup() { rm -f "$SECRET_FILE"; }
trap cleanup EXIT

echo "==============================================="
echo "PedidosCampus — Cloud Smoke Tests"
echo "BASE_URL: $BASE_URL"
echo "==============================================="

# ============================================
# Helpers
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
	code="$(curl -sS --max-time 30 -o "$tmp" -w "%{http_code}" "$@")"
	echo
	echo "=== $name ==="
	echo "HTTP $code"
	json_pretty "$tmp"
	rm -f "$tmp"
}

make_jwt() {
	local sub="$1"
	local role="$2"
	python3 "$(dirname "$0")/_make_jwt.py" "$sub" "$role" "$SECRET_FILE"
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
# Warm-up: Render free tier sleeps services
# Each service needs ~50s to wake. Hit them all.
# ============================================

echo
echo "--- Warming up services (Render free tier) ---"
echo "This may take 2-3 minutes. All services sleep on free tier."

warmup_hit() {
	local url="$1"
	local label="$2"
	local code
	code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 120 "$url" 2>/dev/null || echo "000")
	if [[ "$code" != "000" && "$code" != "502" ]]; then
		echo "  ✓ $label awake (HTTP $code)"
		return 0
	else
		echo "  ✗ $label still down (HTTP $code), retrying..."
		sleep 5
		code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 60 "$url" 2>/dev/null || echo "000")
		if [[ "$code" != "000" && "$code" != "502" ]]; then
			echo "  ✓ $label awake on retry (HTTP $code)"
			return 0
		fi
		echo "  ⚠ $label still HTTP $code — will continue anyway"
		return 1
	fi
}

warmup_hit "$BASE_URL/auth/me" "gateway+auth" || true
warmup_hit "$BASE_URL/restaurants?limit=1" "restaurant-service" || true
warmup_hit "$BASE_URL/api/profiles/me" "user-service" || true
warmup_hit "$BASE_URL/orders/health" "order-service" || true
warmup_hit "$BASE_URL/ratings/health" "rating-service" || true
warmup_hit "$BASE_URL/ai/health" "ai-agent-service" || true

echo
echo "Warm-up complete. Starting tests..."

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

echo "Tokens generated: usuario, repartidor, admin"

# ============================================
# 1. AUTH SERVICE
# ============================================

echo
echo "==============================================="
echo "1. AUTH SERVICE"
echo "==============================================="

# Register
REGISTER_EMAIL="smoke$(date +%s)@test.com"
echo "--- POST /auth/register ---"
REGISTER_RESP=$(curl -sS --max-time 30 -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Smoke Test","email":"'"$REGISTER_EMAIL"'","password":"123456","telefono":"+573001234567","direccion":"Calle Test","role":"usuario"}')
echo "$REGISTER_RESP" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESP"
TOK_REAL=$(echo "$REGISTER_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")
echo "Real token from register: ${TOK_REAL:0:40}..."

# Login
echo
echo "--- POST /auth/login ---"
LOGIN_RESP=$(curl -sS --max-time 30 -X POST "$BASE_URL/auth/login" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"email":"'"$REGISTER_EMAIL"'","password":"123456"}')
echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"

# Me with real token
if [ -n "$TOK_REAL" ]; then
	echo
	echo "--- GET /auth/me (real token) ---"
	request "GET /auth/me" \
		-X GET "$BASE_URL/auth/me" \
		-H "Authorization: Bearer $TOK_REAL" \
		-H "x-service-token: $SERVICE_TOKEN"
fi

# Me with generated admin token
echo
echo "--- GET /auth/me (admin generated) ---"
request "GET /auth/me (admin)" \
	-X GET "$BASE_URL/auth/me" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# Admin ping
echo
echo "--- GET /auth/admin/ping ---"
request "GET /auth/admin/ping" \
	-X GET "$BASE_URL/auth/admin/ping" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# No service token -> 403
echo
echo "--- POST /auth/register without x-service-token (403 expected) ---"
request "No service token" \
	-X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"Fail","email":"fail@test.com","password":"123456"}'

# ============================================
# 2. RESTAURANT SERVICE
# ============================================

echo
echo "==============================================="
echo "2. RESTAURANT SERVICE"
echo "==============================================="

# List restaurants (public)
echo "--- GET /restaurants (public) ---"
LIST_REST=$(curl -sS --max-time 30 -X GET "$BASE_URL/restaurants?is_active=true&limit=10&offset=0" \
	-H "x-service-token: $SERVICE_TOKEN")
echo "$LIST_REST" | python3 -m json.tool 2>/dev/null || echo "$LIST_REST"

# Create restaurant (admin)
echo
echo "--- POST /restaurants (admin) ---"
CREATE_REST=$(curl -sS --max-time 30 -X POST "$BASE_URL/restaurants" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Smoke Restaurant","descripcion":"Test desde cloud","direccion":"Av Cloud 123","categoria":"Test"}')
echo "$CREATE_REST" | python3 -m json.tool 2>/dev/null || echo "$CREATE_REST"
REST_ID=$(extract_field "$CREATE_REST" "id")
echo "Restaurant ID: ${REST_ID:-<none>}"

if [[ -n "$REST_ID" ]]; then
	echo
	echo "--- GET /restaurants/{id} ---"
	request "Get restaurant" \
		-X GET "$BASE_URL/restaurants/$REST_ID" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- POST /restaurants/{id}/products ---"
	CREATE_PROD=$(curl -sS --max-time 30 -X POST "$BASE_URL/restaurants/$REST_ID/products" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"nombre":"Smoke Product","descripcion":"Test product","precio":"5.50","disponible":true}')
	echo "$CREATE_PROD" | python3 -m json.tool 2>/dev/null || echo "$CREATE_PROD"
	PROD_ID=$(extract_field "$CREATE_PROD" "id")
	echo "Product ID: ${PROD_ID:-<none>}"

	if [[ -n "$PROD_ID" ]]; then
		echo
		echo "--- GET /restaurants/products/{id} ---"
		request "Get product" \
			-X GET "$BASE_URL/restaurants/products/$PROD_ID" \
			-H "x-service-token: $SERVICE_TOKEN"

		echo
		echo "--- POST /restaurants/products/validate-batch ---"
		request "Validate batch" \
			-X POST "$BASE_URL/restaurants/products/validate-batch" \
			-H "Content-Type: application/json" \
			-H "x-service-token: $SERVICE_TOKEN" \
			-d "{\"items\":[{\"producto_id\":\"$PROD_ID\",\"precio_unit\":\"5.50\"}]}"
	fi
fi

# Without admin -> 403
echo
echo "--- POST /restaurants without admin (403 expected) ---"
request "No admin" \
	-X POST "$BASE_URL/restaurants" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"nombre":"Fail","direccion":"Test","categoria":"Test"}'

# ============================================
# 3. USER SERVICE
# ============================================

echo
echo "==============================================="
echo "3. USER SERVICE"
echo "==============================================="

# Create profile
echo "--- POST /api/profiles (usuario) ---"
CREATE_PROFILE=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"tipo":"usuario","nombre":"Smoke User","telefono":"+573001234567","direccion":"Calle Cloud"}')
echo "$CREATE_PROFILE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_PROFILE"

# Get profile
echo
echo "--- GET /api/profiles/me ---"
request "Get profile" \
	-X GET "$BASE_URL/api/profiles/me" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Create repartidor profile
echo
echo "--- POST /api/profiles (repartidor) ---"
request "Create repartidor profile" \
	-X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"tipo":"repartidor","nombre":"Smoke Repartidor","telefono":"+573009998877"}'

# Set availability
echo
echo "--- POST /api/profiles/me/availability ---"
request "Set availability" \
	-X POST "$BASE_URL/api/profiles/me/availability" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"disponible":true}'

# Admin list
echo
echo "--- GET /api/profiles (admin) ---"
request "List profiles (admin)" \
	-X GET "$BASE_URL/api/profiles?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-service-token: $SERVICE_TOKEN"

# ============================================
# 4. ORDER SERVICE
# ============================================

echo
echo "==============================================="
echo "4. ORDER SERVICE"
echo "==============================================="

# Health
echo "--- GET /orders/health ---"
request "Health" \
	-X GET "$BASE_URL/orders/health" \
	-H "x-service-token: $SERVICE_TOKEN"

# List orders
echo
echo "--- GET /orders (usuario) ---"
request "List orders" \
	-X GET "$BASE_URL/orders?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Create order
ORDER_REST_ID="${REST_ID:-550e8400-e29b-41d4-a716-446655440000}"
ORDER_PROD_ID="${PROD_ID:-550e8400-e29b-41d4-a716-446655440100}"

echo
echo "--- POST /orders (usuario) ---"
CREATE_ORDER=$(curl -sS --max-time 30 -X POST "$BASE_URL/orders" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"restauranteId":"'"$ORDER_REST_ID"'","direccionEntrega":"Calle Cloud 123","items":[{"productId":"'"$ORDER_PROD_ID"'","nombre":"Smoke Product","precioUnit":5.50,"cantidad":1}]}')
echo "$CREATE_ORDER" | python3 -m json.tool 2>/dev/null || echo "$CREATE_ORDER"
ORDER_ID=$(extract_field "$CREATE_ORDER" "id")
echo "Order ID: ${ORDER_ID:-<none>}"

if [[ -n "$ORDER_ID" ]]; then
	echo
	echo "--- GET /orders/{id} ---"
	request "Get order" \
		-X GET "$BASE_URL/orders/$ORDER_ID" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- GET /orders/{id}/history ---"
	request "Order history" \
		-X GET "$BASE_URL/orders/$ORDER_ID/history" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- POST /orders/{id}/accept (repartidor) ---"
	request "Accept order" \
		-X POST "$BASE_URL/orders/$ORDER_ID/accept" \
		-H "Authorization: Bearer $TOK_REP" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d "{\"repartidorId\":\"$REPARTIDOR_SUB\"}"

	echo
	echo "--- POST /orders/{id}/status en_camino ---"
	request "Status en_camino" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_REP" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"toEstado":"en_camino"}'

	echo
	echo "--- POST /orders/{id}/status entregado ---"
	request "Status entregado" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"toEstado":"entregado"}'
fi

# Available orders
echo
echo "--- GET /orders/available (repartidor) ---"
request "Available orders" \
	-X GET "$BASE_URL/orders/available?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "x-service-token: $SERVICE_TOKEN"

# No auth -> 401
echo
echo "--- GET /orders without auth (401 expected) ---"
request "No auth" \
	-X GET "$BASE_URL/orders"

# ============================================
# 5. RATING SERVICE
# ============================================

echo
echo "==============================================="
echo "5. RATING SERVICE"
echo "==============================================="

# Create restaurant rating
echo "--- POST /ratings/restaurant ---"
CREATE_RATING=$(curl -sS --max-time 30 -X POST "$BASE_URL/ratings/restaurant" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"pedido_id":"550e8400-e29b-41d4-a716-446655440001","restaurante_id":"650e8400-e29b-41d4-a716-446655440001","estrellas":5,"comentario":"Smoke test cloud"}')
echo "$CREATE_RATING" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RATING"
RATING_ID=$(extract_field "$CREATE_RATING" "id")
echo "Rating ID: ${RATING_ID:-<none>}"

if [[ -n "$RATING_ID" ]]; then
	echo
	echo "--- GET /ratings/restaurant/{id} ---"
	request "Get rating" \
		-X GET "$BASE_URL/ratings/restaurant/$RATING_ID" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "x-service-token: $SERVICE_TOKEN"

	echo
	echo "--- PATCH /ratings/restaurant/{id} ---"
	request "Update rating" \
		-X PATCH "$BASE_URL/ratings/restaurant/$RATING_ID" \
		-H "Authorization: Bearer $TOK_USR" \
		-H "Content-Type: application/json" \
		-H "x-service-token: $SERVICE_TOKEN" \
		-d '{"estrellas":4,"comentario":"Updated smoke test"}'
fi

# Stats
echo
echo "--- GET /ratings/stats/restaurant/{id} ---"
request "Restaurant stats" \
	-X GET "$BASE_URL/ratings/stats/restaurant/650e8400-e29b-41d4-a716-446655440001" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# Delivery rating
echo
echo "--- POST /ratings/delivery ---"
CREATE_DEL=$(curl -sS --max-time 30 -X POST "$BASE_URL/ratings/delivery" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"pedido_id":"550e8400-e29b-41d4-a716-446655440000","repartidor_id":"750e8400-e29b-41d4-a716-446655440002","estrellas":5,"comentario":"Smoke delivery test"}')
echo "$CREATE_DEL" | python3 -m json.tool 2>/dev/null || echo "$CREATE_DEL"
DEL_RATING_ID=$(extract_field "$CREATE_DEL" "id")
echo "Delivery Rating ID: ${DEL_RATING_ID:-<none>}"

# Delivery stats
echo
echo "--- GET /ratings/stats/delivery/{id} ---"
request "Delivery stats" \
	-X GET "$BASE_URL/ratings/stats/delivery/750e8400-e29b-41d4-a716-446655440002" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "x-service-token: $SERVICE_TOKEN"

# ============================================
# 6. AI AGENT SERVICE
# ============================================

echo
echo "==============================================="
echo "6. AI AGENT SERVICE"
echo "==============================================="

echo "--- GET /ai/health ---"
request "AI Agent health" \
	-X GET "$BASE_URL/ai/health" \
	-H "x-service-token: $SERVICE_TOKEN"

# ============================================
# SUMMARY
# ============================================

echo
echo "==============================================="
echo "SMOKE TESTS COMPLETE"
echo "==============================================="
echo "Review HTTP codes above for failures."
echo "Expected: 200/201 for success, 401/403/409 for negative tests."
echo "==============================================="
