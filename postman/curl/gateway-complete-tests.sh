#!/usr/bin/env bash
set -euo pipefail

# =====================================================
# API Gateway Complete Manual Tests
# Tests ALL endpoints through the API Gateway (port 3000)
# =====================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-dev_access_token_secret_123_very_secret}"
SERVICE_TOKEN="${SERVICE_TOKEN:-internal_super_secret_token_123}"

echo "=============================================="
echo "API Gateway Complete Tests"
echo "Base URL: $BASE_URL"
echo "=============================================="

# Helper functions
json_pretty() {
    python3 -c "
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    print('(empty)')
else:
    try:
        print(json.dumps(json.loads(raw), indent=2))
    except:
        print(raw)
"
}

request() {
    local name="$1"
    shift
    local tmp=$(mktemp)
    local code=$(curl -sS -o "$tmp" -w "%{http_code}" "$@")
    echo ""
    echo "=== $name ==="
    echo "HTTP $code"
    json_pretty < "$tmp"
    rm -f "$tmp"
}

make_jwt() {
    python3 - "$ACCESS_TOKEN_SECRET" "$1" "$2" <<'PY'
import base64, json, hmac, hashlib, time, sys
secret = sys.argv[1].encode()
sub, role = sys.argv[2], sys.argv[3]
now = int(time.time())
header = {"alg": "HS256", "typ": "JWT"}
payload = {"sub": sub, "email": f"{role}@test.com", "role": role, "iat": now, "exp": now + 86400}
enc = lambda o: base64.urlsafe_b64encode(json.dumps(o, separators=(',', ':')).encode()).rstrip(b'=')
h, p = enc(header), enc(payload)
s = base64.urlsafe_b64encode(hmac.new(secret, h + b'.' + p, hashlib.sha256).digest()).rstrip(b'=')
print((h + b'.' + p + b'.' + s).decode())
PY
}

extract_field() {
    python3 - "$1" "$2" <<'PY'
import json, sys
try:
    d = json.loads(sys.argv[1])
    print(d.get(sys.argv[2], ''))
except:
    print('')
PY
}

# Generate tokens
USUARIO_SUB="550e8400-e29b-41d4-a716-446655440000"
REPARTIDOR_SUB="550e8400-e29b-41d4-a716-446655440001"
ADMIN_SUB="550e8400-e29b-41d4-a716-446655440002"

TOK_USR=$(make_jwt "$USUARIO_SUB" "usuario")
TOK_REP=$(make_jwt "$REPARTIDOR_SUB" "repartidor")
TOK_ADM=$(make_jwt "$ADMIN_SUB" "admin")

echo "Tokens generated for: usuario, repartidor, admin"

# =====================================================
# AUTH SERVICE TESTS (/auth)
# =====================================================
echo ""
echo "=============================================="
echo "AUTH SERVICE"
echo "=============================================="

# Register (public) - get real token
REGISTER_EMAIL="test$(date +%s)@test.com"
echo "--- POST /auth/register ---"
REGISTER_RESP=$(curl -sS -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"nombre":"Test User","email":"'"$REGISTER_EMAIL"'","password":"123456","role":"usuario"}')
echo "$REGISTER_RESP" | json_pretty
TOK_USR=$(echo "$REGISTER_RESP" | jq -r '.accessToken // empty')

# Login (public) - use same email
echo "--- POST /auth/login ---"
LOGIN_RESP=$(curl -sS -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"email":"'"$REGISTER_EMAIL"'","password":"123456"}')
echo "$LOGIN_RESP" | json_pretty
TOK_REP=$(echo "$LOGIN_RESP" | jq -r '.accessToken // empty')

echo "Obtained real tokens from auth-service"

# Me (requires JWT)
echo "--- GET /auth/me (usuario) ---"
request "Get me (usuario)" \
    -X GET "$BASE_URL/auth/me" \
    -H "Authorization: Bearer $TOK_USR" \
    -H "x-service-token: $SERVICE_TOKEN"

echo "--- GET /auth/me (repartidor) ---"
request "Get me (repartidor)" \
    -X GET "$BASE_URL/auth/me" \
    -H "Authorization: Bearer $TOK_REP" \
    -H "x-service-token: $SERVICE_TOKEN"

echo "--- GET /auth/admin/ping (admin) ---"
request "Admin ping" \
    -X GET "$BASE_URL/auth/admin/ping" \
    -H "Authorization: Bearer $TOK_ADM" \
    -H "x-service-token: $SERVICE_TOKEN"

echo "--- POST /auth/register (no token - expect 400) ---"
request "Register without token" \
    -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"nombre":"Fail","email":"fail@test.com","password":"123456"}'

# =====================================================
# RESTAURANT SERVICE TESTS (/restaurants)
# =====================================================
echo ""
echo "=============================================="
echo "RESTAURANT SERVICE"
echo "=============================================="

# GET restaurants (public)
echo "--- GET /restaurants (public) ---"
request "List restaurants" \
    -X GET "$BASE_URL/restaurants?is_active=true&limit=10&offset=0" \
    -H "x-service-token: $SERVICE_TOKEN"

# POST restaurant (admin only)
echo "--- POST /restaurants (admin) ---"
REST_RESP=$(curl -sS -X POST "$BASE_URL/restaurants" \
    -H "Authorization: Bearer $TOK_ADM" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"nombre":"Test Restaurant","descripcion":"Test","direccion":"Calle 123","categoria":"Test"}')
echo "$REST_RESP" | json_pretty
REST_ID=$(extract_field "$REST_RESP" "id")
echo "Created restaurant ID: $REST_ID"

# GET restaurant by ID
if [[ -n "$REST_ID" ]]; then
    echo "--- GET /restaurants/{id} ---"
    request "Get restaurant" \
        -X GET "$BASE_URL/restaurants/$REST_ID" \
        -H "x-service-token: $SERVICE_TOKEN"

    # PATCH restaurant
    echo "--- PATCH /restaurants/{id} ---"
    request "Update restaurant" \
        -X PATCH "$BASE_URL/restaurants/$REST_ID" \
        -H "Authorization: Bearer $TOK_ADM" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d '{"descripcion":"Updated description"}'

    # POST product
    echo "--- POST /restaurants/{id}/products ---"
    PROD_RESP=$(curl -sS -X POST "$BASE_URL/restaurants/$REST_ID/products" \
        -H "Authorization: Bearer $TOK_ADM" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d '{"nombre":"Test Product","descripcion":"Test","precio":5.50,"disponible":true}')
    echo "$PROD_RESP" | json_pretty
    PROD_ID=$(extract_field "$PROD_RESP" "id")
    echo "Created product ID: $PROD_ID"

    # GET products
    echo "--- GET /restaurants/{id}/products ---"
    request "List products" \
        -X GET "$BASE_URL/restaurants/$REST_ID/products" \
        -H "x-service-token: $SERVICE_TOKEN"

    # GET product by ID
    if [[ -n "$PROD_ID" ]]; then
        echo "--- GET /products/{id} ---"
        request "Get product" \
            -X GET "$BASE_URL/restaurants/products/$PROD_ID" \
            -H "x-service-token: $SERVICE_TOKEN"

        # PATCH product
        echo "--- PATCH /products/{id} ---"
        request "Update product" \
            -X PATCH "$BASE_URL/restaurants/products/$PROD_ID" \
            -H "Authorization: Bearer $TOK_ADM" \
            -H "Content-Type: application/json" \
            -H "x-service-token: $SERVICE_TOKEN" \
            -d '{"precio":6.00}'

        # Validate batch
        echo "--- POST /products/validate-batch ---"
        request "Validate batch" \
            -X POST "$BASE_URL/restaurants/products/validate-batch" \
            -H "Content-Type: application/json" \
            -H "x-service-token: $SERVICE_TOKEN" \
            -d "{\"items\":[{\"producto_id\":\"$PROD_ID\",\"precio_unit\":6.00}]}"

        # DELETE product
        echo "--- DELETE /products/{id} ---"
        request "Delete product" \
            -X DELETE "$BASE_URL/restaurants/products/$PROD_ID" \
            -H "Authorization: Bearer $TOK_ADM" \
            -H "x-service-token: $SERVICE_TOKEN"
    fi

    # Activate/Deactivate
    echo "--- POST /restaurants/{id}/deactivate ---"
    request "Deactivate restaurant" \
        -X POST "$BASE_URL/restaurants/$REST_ID/deactivate" \
        -H "Authorization: Bearer $TOK_ADM" \
        -H "x-service-token: $SERVICE_TOKEN"

    echo "--- POST /restaurants/{id}/activate ---"
    request "Activate restaurant" \
        -X POST "$BASE_URL/restaurants/$REST_ID/activate" \
        -H "Authorization: Bearer $TOK_ADM" \
        -H "x-service-token: $SERVICE_TOKEN"
fi

# Test without admin (should fail 403)
echo "--- POST /restaurants (no admin - expect 403) ---"
request "Create without admin" \
    -X POST "$BASE_URL/restaurants" \
    -H "Authorization: Bearer $TOK_USR" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"nombre":"Fail","direccion":"Test","categoria":"Test"}'

# =====================================================
# ORDER SERVICE TESTS (/orders)
# =====================================================
echo ""
echo "=============================================="
echo "ORDER SERVICE"
echo "=============================================="

# Get real restaurant ID for order creation
REST_LIST=$(curl -sS -X GET "$BASE_URL/restaurants?limit=1&offset=0" -H "x-service-token: $SERVICE_TOKEN")
REST_ID=$(echo "$REST_LIST" | jq -r '.items[0].id // empty')
PROD_LIST=$(curl -sS -X GET "$BASE_URL/restaurants/$REST_ID/products" -H "x-service-token: $SERVICE_TOKEN")
PROD_ID=$(echo "$PROD_LIST" | jq -r '.items[0].id // empty')
PROD_PRECIO=$(echo "$PROD_LIST" | jq -r '.items[0].precio // "5.00"' | sed 's/[^0-9.]//g')

echo "Testing with restaurant: $REST_ID, product: $PROD_ID (precio: $PROD_PRECIO)"

# GET orders (requires JWT)
echo "--- GET /orders (usuario) ---"
request "List orders" \
    -X GET "$BASE_URL/orders?limit=10&offset=0" \
    -H "Authorization: Bearer $TOK_USR" \
    -H "x-service-token: $SERVICE_TOKEN"

# POST order (requires JWT usuario + valid restaurant)
echo "--- POST /orders (usuario) ---"
ORDER_RESP=$(curl -sS -X POST "$BASE_URL/orders" \
    -H "Authorization: Bearer $TOK_USR" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"restauranteId":"'"$REST_ID"'","direccionEntrega":"Calle 123","items":[{"productId":"'"$PROD_ID"'","nombre":"Test","precioUnit":'"$PROD_PRECIO"',"cantidad":1}]}')
echo "$ORDER_RESP" | json_pretty
ORDER_ID=$(echo "$ORDER_RESP" | jq -r '.id // empty')
echo "Order ID: $ORDER_ID"

# GET order by ID
if [[ -n "$ORDER_ID" ]]; then
    echo "--- GET /orders/{id} ---"
    request "Get order" \
        -X GET "$BASE_URL/orders/$ORDER_ID" \
        -H "Authorization: Bearer $TOK_USR" \
        -H "x-service-token: $SERVICE_TOKEN"

    echo "--- GET /orders/{id}/history ---"
    request "Get order history" \
        -X GET "$BASE_URL/orders/$ORDER_ID/history" \
        -H "Authorization: Bearer $TOK_USR" \
        -H "x-service-token: $SERVICE_TOKEN"

    echo "--- POST /orders/{id}/accept ---"
    request "Accept order" \
        -X POST "$BASE_URL/orders/$ORDER_ID/accept" \
        -H "Authorization: Bearer $TOK_REP" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d "{\"repartidorId\":\"$REPARTIDOR_SUB\"}"

    echo "--- POST /orders/{id}/status (en_camino) ---"
    request "Status en_camino" \
        -X POST "$BASE_URL/orders/$ORDER_ID/status" \
        -H "Authorization: Bearer $TOK_REP" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d '{"toEstado":"en_camino"}'

    echo "--- POST /orders/{id}/status (entregado) ---"
    request "Status entregado" \
        -X POST "$BASE_URL/orders/$ORDER_ID/status" \
        -H "Authorization: Bearer $TOK_ADM" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d '{"toEstado":"entregado"}'

    echo "--- POST /orders/{id}/cancel (expect 409 - already delivered) ---"
    request "Cancel delivered" \
        -X POST "$BASE_URL/orders/$ORDER_ID/cancel" \
        -H "Authorization: Bearer $TOK_USR" \
        -H "Content-Type: application/json" \
        -H "x-service-token: $SERVICE_TOKEN" \
        -d '{"reason":"Test"}'
fi

# GET orders/active (admin)
echo "--- GET /orders/active (admin) ---"
request "Active orders" \
    -X GET "$BASE_URL/orders/active?limit=10&offset=0" \
    -H "Authorization: Bearer $TOK_ADM" \
    -H "x-service-token: $SERVICE_TOKEN"

# GET orders/available (repartidor)
echo "--- GET /orders/available (repartidor) ---"
request "Available orders" \
    -X GET "$BASE_URL/orders/available?limit=10&offset=0" \
    -H "Authorization: Bearer $TOK_REP" \
    -H "x-service-token: $SERVICE_TOKEN"

# GET orders/deliverer/{id}
echo "--- GET /orders/deliverer/{id} ---"
request "Deliverer orders" \
    -X GET "$BASE_URL/orders/deliverer/$REPARTIDOR_SUB?limit=10&offset=0" \
    -H "Authorization: Bearer $TOK_REP" \
    -H "x-service-token: $SERVICE_TOKEN"

# Without auth
echo "--- GET /orders (no auth - expect 401) ---"
request "No auth" \
    -X GET "$BASE_URL/orders"

# =====================================================
# RATING SERVICE TESTS (/ratings) - Note: blocked by gateway auth
# =====================================================
echo ""
echo "=============================================="
echo "RATING SERVICE (Note: blocked by gateway auth)"
echo "=============================================="

# Test direct to rating service
echo "--- Testing direct to rating-service:8003 ---"
curl -s "http://localhost:8003/health" | json_pretty

echo "--- POST /ratings/restaurant (direct) ---"
RATING_RESP=$(curl -sS -X POST "http://localhost:8003/ratings/restaurant" \
    -H "Content-Type: application/json" \
    -d '{"pedido_id":"550e8400-e29b-41d4-a716-446655440001","restaurante_id":"650e8400-e29b-41d4-a716-446655440001","estrellas":5,"comentario":"Test"}')
echo "$RATING_RESP" | json_pretty
RATING_ID=$(extract_field "$RATING_RESP" "id")

if [[ -n "$RATING_ID" ]]; then
    echo "--- GET /ratings/restaurant/{id} (direct) ---"
    curl -s "http://localhost:8003/ratings/restaurant/$RATING_ID" | json_pretty

    echo "--- PATCH /ratings/restaurant/{id} (direct) ---"
    curl -s -X PATCH "http://localhost:8003/ratings/restaurant/$RATING_ID" \
        -H "Content-Type: application/json" \
        -d '{"estrellas":4,"comentario":"Updated"}' | json_pretty

    echo "--- DELETE /ratings/restaurant/{id} (direct) ---"
    curl -s -X DELETE "http://localhost:8003/ratings/restaurant/$RATING_ID"
    echo ""
fi

echo "--- GET /ratings/restaurant/restaurant/{id} (direct) ---"
curl -s "http://localhost:8003/ratings/restaurant/restaurant/650e8400-e29b-41d4-a716-446655440001" | json_pretty

echo "--- GET /ratings/stats/restaurant/{id} (direct) ---"
curl -s "http://localhost:8003/ratings/stats/restaurant/650e8400-e29b-41d4-a716-446655440001" | json_pretty

# =====================================================
# USER SERVICE TESTS (/api/profiles)
# =====================================================
echo ""
echo "=============================================="
echo "USER SERVICE (BUG - returns 500)"
echo "=============================================="

echo "--- Testing user-service (expect 500 error) ---"
curl -s -X POST "http://localhost:3000/api/profiles" \
    -H "Authorization: Bearer $TOK_USR" \
    -H "Content-Type: application/json" \
    -H "x-service-token: $SERVICE_TOKEN" \
    -d '{"tipo":"usuario","nombre":"Test"}' 2>&1 | head -20

echo ""
echo "=============================================="
echo "TEST COMPLETE"
echo "=============================================="