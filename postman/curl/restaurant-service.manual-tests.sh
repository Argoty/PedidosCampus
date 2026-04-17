#!/usr/bin/env bash
set -euo pipefail

# Clones curl de endpoints restaurant-service
# Uso:
#   chmod +x postman/curl/restaurant-service.manual-tests.sh
#   postman/curl/restaurant-service.manual-tests.sh
#
# Opcionales:
#   BASE_URL=http://localhost:8001
#   SECRET_KEY=dev_access_token_secret_123_very_secret

BASE_URL="${BASE_URL:-http://localhost:8001}"
SECRET_KEY="${SECRET_KEY:-dev_access_token_secret_123_very_secret}"

ADMIN_SUB="550e8400-e29b-41d4-a716-446655440002"
USER_SUB="550e8400-e29b-41d4-a716-446655440000"

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
	python3 - "$SECRET_KEY" "$sub" "$role" <<'PY'
import base64, json, hmac, hashlib, time, sys
secret=sys.argv[1].encode()
sub=sys.argv[2]
role=sys.argv[3]
now=int(time.time())
header={"alg":"HS256","typ":"JWT"}
payload={
  "sub":sub,
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

echo "BASE_URL=$BASE_URL"
echo "SECRET_KEY=<hidden>"

TOK_ADMIN="$(make_jwt "$ADMIN_SUB" "admin")"
TOK_USER="$(make_jwt "$USER_SUB" "usuario")"

request "GET /health" \
	-X GET "$BASE_URL/health"

CREATE_RESTAURANT_RAW="$(curl -sS -X POST "$BASE_URL/api/v1/restaurants" \
	-H "Authorization: Bearer $TOK_ADMIN" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"La Parrilla Manual","descripcion":"Comida universitaria","direccion":"Av. Universidad 100","categoria":"Comida Rapida","imagenUrl":"https://example.com/img.jpg"}')"

echo
echo "=== POST /api/v1/restaurants ==="
echo "$CREATE_RESTAURANT_RAW" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESTAURANT_RAW"

RESTAURANT_ID="$(extract_field "$CREATE_RESTAURANT_RAW" "id")"
echo "restaurantId=${RESTAURANT_ID:-<none>}"

request "GET /api/v1/restaurants" \
	-X GET "$BASE_URL/api/v1/restaurants?is_active=true&limit=10&offset=0"

if [[ -n "$RESTAURANT_ID" ]]; then
	request "GET /api/v1/restaurants/{id}" \
		-X GET "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID"

	request "PATCH /api/v1/restaurants/{id}" \
		-X PATCH "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID" \
		-H "Authorization: Bearer $TOK_ADMIN" \
		-H "Content-Type: application/json" \
		-d '{"descripcion":"Mejor comida"}'

	request "POST /api/v1/restaurants/{id}/deactivate" \
		-X POST "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID/deactivate" \
		-H "Authorization: Bearer $TOK_ADMIN"

	request "POST /api/v1/restaurants/{id}/activate" \
		-X POST "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID/activate" \
		-H "Authorization: Bearer $TOK_ADMIN"

	CREATE_PRODUCT_RAW="$(curl -sS -X POST "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID/products" \
		-H "Authorization: Bearer $TOK_ADMIN" \
		-H "Content-Type: application/json" \
		-d '{"nombre":"Empanada","descripcion":"Rellena de queso","precio":"2.50","disponible":true}')"

	echo
	echo "=== POST /api/v1/restaurants/{id}/products ==="
	echo "$CREATE_PRODUCT_RAW" | python3 -m json.tool 2>/dev/null || echo "$CREATE_PRODUCT_RAW"

	PRODUCT_ID="$(extract_field "$CREATE_PRODUCT_RAW" "id")"
	echo "productId=${PRODUCT_ID:-<none>}"

	request "GET /api/v1/restaurants/{id}/products" \
		-X GET "$BASE_URL/api/v1/restaurants/$RESTAURANT_ID/products?disponible=true"

	if [[ -n "$PRODUCT_ID" ]]; then
		request "GET /api/v1/products/{id}" \
			-X GET "$BASE_URL/api/v1/products/$PRODUCT_ID"

		request "PATCH /api/v1/products/{id}" \
			-X PATCH "$BASE_URL/api/v1/products/$PRODUCT_ID" \
			-H "Authorization: Bearer $TOK_ADMIN" \
			-H "Content-Type: application/json" \
			-d '{"precio":"3.00"}'

		request "POST /api/v1/products/validate-batch" \
			-X POST "$BASE_URL/api/v1/products/validate-batch" \
			-H "Content-Type: application/json" \
			-d "{\"items\":[{\"producto_id\":\"$PRODUCT_ID\",\"precio_unit\":\"3.00\"}]}"

		request "DELETE /api/v1/products/{id} (soft delete)" \
			-X DELETE "$BASE_URL/api/v1/products/$PRODUCT_ID" \
			-H "Authorization: Bearer $TOK_ADMIN"

		request "GET /api/v1/products/{id} after delete" \
			-X GET "$BASE_URL/api/v1/products/$PRODUCT_ID"
	else
		echo "[WARN] Skipping product detail/update/delete: productId not resolved"
	fi
else
	echo "[WARN] Skipping restaurant/product flow: restaurantId not resolved"
fi

request "POST /api/v1/restaurants without admin (expect 403)" \
	-X POST "$BASE_URL/api/v1/restaurants" \
	-H "Authorization: Bearer $TOK_USER" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"Forbidden","direccion":"Test","categoria":"Test"}'

echo
echo "Done. Restaurant curl suite finished."
