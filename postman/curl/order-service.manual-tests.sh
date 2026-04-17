#!/usr/bin/env bash
set -euo pipefail

# Curl manual tests for order-service endpoints
# Usage:
#   chmod +x postman/curl/order-service.manual-tests.sh
#   postman/curl/order-service.manual-tests.sh
#
# Optional env:
#   BASE_URL=http://localhost:8002
#   JWT_SECRET=dev_access_token_secret_123_very_secret

BASE_URL="${BASE_URL:-http://localhost:8002}"
JWT_SECRET="${JWT_SECRET:-dev_access_token_secret_123_very_secret}"

USUARIO_ID="550e8400-e29b-41d4-a716-446655440002"
REPARTIDOR_ID="550e8400-e29b-41d4-a716-446655440003"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440004"
RESTAURANTE_ID="550e8400-e29b-41d4-a716-446655440000"
PRODUCTO_1="550e8400-e29b-41d4-a716-446655440100"

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
	python3 - "$JWT_SECRET" "$sub" "$role" <<'PY'
import base64, json, hmac, hashlib, time, sys
secret=sys.argv[1].encode()
sub=sys.argv[2]
role=sys.argv[3]
now=int(time.time())
header={"alg":"HS256","typ":"JWT"}
payload={
  "sub":sub,
  "userId":sub,
  "role":role,
  "iat":now,
  "exp":now + 180*24*3600
}
enc=lambda o: base64.urlsafe_b64encode(json.dumps(o,separators=(',',':')).encode()).rstrip(b'=')
h=enc(header); p=enc(payload)
s=base64.urlsafe_b64encode(hmac.new(secret,h+b'.'+p,hashlib.sha256).digest()).rstrip(b'=')
print((h+b'.'+p+b'.'+s).decode())
PY
}

extract_json_field() {
	local json_text="$1"
	local field="$2"
	python3 - "$json_text" "$field" <<'PY'
import json,sys
raw=sys.argv[1].strip()
field=sys.argv[2]
if not raw:
    print('')
    raise SystemExit
try:
    d=json.loads(raw)
    v=d.get(field, '') if isinstance(d, dict) else ''
    print(v if v is not None else '')
except Exception:
    print('')
PY
}

echo "BASE_URL=$BASE_URL"
echo "JWT_SECRET=<hidden>"

TOK_USUARIO="$(make_jwt "$USUARIO_ID" "usuario")"
TOK_REPARTIDOR="$(make_jwt "$REPARTIDOR_ID" "repartidor")"
TOK_ADMIN="$(make_jwt "$ADMIN_ID" "admin")"

request "GET /health" \
	-X GET "$BASE_URL/health"

CREATE_ORDER_RAW="$(curl -sS -X POST "$BASE_URL/orders" \
	-H "Authorization: Bearer $TOK_USUARIO" \
	-H "Content-Type: application/json" \
	-d "{\"restauranteId\":\"$RESTAURANTE_ID\",\"direccionEntrega\":\"Calle 123 Apto 4\",\"items\":[{\"productId\":\"$PRODUCTO_1\",\"nombre\":\"Hamburguesa\",\"precioUnit\":12000,\"cantidad\":1}]}")"

echo
echo "=== POST /orders (usuario) ==="
echo "$CREATE_ORDER_RAW" | python3 -m json.tool 2>/dev/null || echo "$CREATE_ORDER_RAW"

ORDER_ID="$(extract_json_field "$CREATE_ORDER_RAW" "id")"
echo "orderId=${ORDER_ID:-<none>}"

request "GET /orders (usuario)" \
	-X GET "$BASE_URL/orders?limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_USUARIO"

if [[ -n "$ORDER_ID" ]]; then
	request "GET /orders/{id} (usuario)" \
		-X GET "$BASE_URL/orders/$ORDER_ID" \
		-H "Authorization: Bearer $TOK_USUARIO"

	request "GET /orders/{id}/history (usuario)" \
		-X GET "$BASE_URL/orders/$ORDER_ID/history" \
		-H "Authorization: Bearer $TOK_USUARIO"

	request "POST /orders/{id}/accept (repartidor)" \
		-X POST "$BASE_URL/orders/$ORDER_ID/accept" \
		-H "Authorization: Bearer $TOK_REPARTIDOR" \
		-H "Content-Type: application/json" \
		-d "{\"repartidorId\":\"$REPARTIDOR_ID\"}"

	request "POST /orders/{id}/status en_camino (repartidor)" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_REPARTIDOR" \
		-H "Content-Type: application/json" \
		-d '{"toEstado":"en_camino"}'

	request "POST /orders/{id}/status entregado (admin)" \
		-X POST "$BASE_URL/orders/$ORDER_ID/status" \
		-H "Authorization: Bearer $TOK_ADMIN" \
		-H "Content-Type: application/json" \
		-d '{"toEstado":"entregado"}'

	request "GET /orders/active (admin)" \
		-X GET "$BASE_URL/orders/active?limit=10&offset=0&repartidorId=$REPARTIDOR_ID" \
		-H "Authorization: Bearer $TOK_ADMIN"

	request "GET /orders/deliverer/{id} (repartidor propio)" \
		-X GET "$BASE_URL/orders/deliverer/$REPARTIDOR_ID?limit=10&offset=0" \
		-H "Authorization: Bearer $TOK_REPARTIDOR"

	request "GET /orders/deliverer/{id} (usuario, 403 esperado)" \
		-X GET "$BASE_URL/orders/deliverer/$REPARTIDOR_ID?limit=10&offset=0" \
		-H "Authorization: Bearer $TOK_USUARIO"

	request "POST /orders/{id}/cancel (ya entregado, 409 esperado)" \
		-X POST "$BASE_URL/orders/$ORDER_ID/cancel" \
		-H "Authorization: Bearer $TOK_USUARIO" \
		-H "Content-Type: application/json" \
		-d '{"reason":"late cancel test"}'
else
	echo "[WARN] Skipping order-id dependent tests: create order did not return id"
fi

request "GET /orders sin auth (401 esperado)" \
	-X GET "$BASE_URL/orders"

echo
echo "Done. Order curl suite finished."
