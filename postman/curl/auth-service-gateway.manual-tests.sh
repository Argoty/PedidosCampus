#!/usr/bin/env bash
set -euo pipefail

# Auth Service - Tests via API Gateway (puerto 3000)
# Todos los endpoints se acceden a través del Gateway

BASE_URL="${BASE_URL:-http://localhost:3000}"
ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-dev_access_token_secret_123_very_secret}"
SERVICE_TOKEN="${SERVICE_TOKEN:-internal_super_secret_token_123}"

echo "==============================================="
echo "Auth Service - API Gateway Tests"
echo "BASE_URL: $BASE_URL"
echo "==============================================="

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

# Test 1: Register new user
echo
echo "--- TEST 1: POST /auth/register ---"
REGISTER_RESPONSE=$(curl -sS -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"nombre": "Test Usuario",
		"email": "testuser'"$(date +%s)"'@example.com",
		"password": "123456",
		"telefono": "+573001234567",
		"direccion": "Calle Test 123",
		"role": "usuario"
	}')

echo "$REGISTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESPONSE"

# Extract token
USER_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('accessToken', ''))
except:
    print('')
" 2>/dev/null)

USER_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('user', {}).get('id', ''))
except:
    print('')
" 2>/dev/null)

echo
echo "Captured - USER_TOKEN: ${USER_TOKEN:0:50}..."
echo "Captured - USER_ID: $USER_ID"

# Test 2: Login
echo
echo "--- TEST 2: POST /auth/login ---"
LOGIN_RESPONSE=$(curl -sS -X POST "$BASE_URL/auth/login" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"email": "testuser'"$(date +%s)"'@example.com",
		"password": "123456"
	}')

echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

# Test 3: Get current user (/me)
echo
echo "--- TEST 3: GET /auth/me ---"
if [ -n "$USER_TOKEN" ]; then
	request "GET /auth/me" \
		-X GET "$BASE_URL/auth/me" \
		-H "Authorization: Bearer $USER_TOKEN" \
		-H "x-service-token: $SERVICE_TOKEN"
else
	echo "[SKIP] No token available"
fi

# Test 4: Admin ping (needs admin role)
echo
echo "--- TEST 4: GET /auth/admin/ping ---"
# Create admin user first
ADMIN_REGISTER=$(curl -sS -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"nombre": "Admin User",
		"email": "admin'"$(date +%s)"'@example.com",
		"password": "123456",
		"role": "admin"
	}')

ADMIN_TOKEN=$(echo "$ADMIN_REGISTER" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('accessToken', ''))
except:
    print('')
" 2>/dev/null)

echo "Admin token captured: ${ADMIN_TOKEN:0:30}..."

request "GET /auth/admin/ping (with admin token)" \
	-X GET "$BASE_URL/auth/admin/ping" \
	-H "Authorization: Bearer $ADMIN_TOKEN" \
	-H "x-service-token: $SERVICE_TOKEN"

# Test 5: Register repartidor
echo
echo "--- TEST 5: POST /auth/register (repartidor) ---"
REP_REGISTER=$(curl -sS -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"nombre": "Repartidor Test",
		"email": "repartidor'"$(date +%s)"'@example.com",
		"password": "123456",
		"role": "repartidor"
	}')

REP_TOKEN=$(echo "$REP_REGISTER" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('accessToken', ''))
except:
    print('')
" 2>/dev/null)

echo "Repartidor token captured: ${REP_TOKEN:0:30}..."

# Test 6: Me with repartidor token
if [ -n "$REP_TOKEN" ]; then
	request "GET /auth/me (repartidor)" \
		-X GET "$BASE_URL/auth/me" \
		-H "Authorization: Bearer $REP_TOKEN" \
		-H "x-service-token: $SERVICE_TOKEN"
fi

# Test 7: Register another user for refresh test
echo
echo "--- TEST 7: POST /auth/register (for refresh) ---"
REFRESH_USER=$(curl -sS -X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{
		"nombre": "Refresh Test",
		"email": "refresh'"$(date +%s)"'@example.com",
		"password": "123456"
	}')

REFRESH_TOKEN=$(echo "$REFRESH_USER" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('accessToken', ''))
except:
    print('')
" 2>/dev/null)

REFRESH_COOKIE=$(echo "$REFRESH_USER" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # The refresh token comes in a cookie, which we can't capture directly from curl
    print('')
except:
    print('')
" 2>/dev/null)

echo "Token for refresh test captured"

# Test 8: Test forbidden without service token
echo
echo "--- TEST 8: POST /auth/register without x-service-token (403 expected) ---"
request "POST /auth/register (no service token)" \
	-X POST "$BASE_URL/auth/register" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"Fail","email":"fail@test.com","password":"123456"}'

# Test 9: Test invalid credentials
echo
echo "--- TEST 9: POST /auth/login invalid credentials (401 expected) ---"
request "POST /auth/login (invalid)" \
	-X POST "$BASE_URL/auth/login" \
	-H "Content-Type: application/json" \
	-H "x-service-token: $SERVICE_TOKEN" \
	-d '{"email":"nonexistent@test.com","password":"wrongpass"}'

echo
echo "==============================================="
echo "Auth Service Tests Complete!"
echo "==============================================="