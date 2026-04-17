#!/usr/bin/env bash
set -euo pipefail

# Clones curl de colección Postman user-service
# Uso:
#   chmod +x postman/curl/user-service.manual-tests.sh
#   postman/curl/user-service.manual-tests.sh
#
# Opcionales:
#   BASE_URL=http://localhost:5000
#   ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret

BASE_URL="${BASE_URL:-http://localhost:5000}"
ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-dev_access_token_secret_123_very_secret}"

# UUIDs de prueba (alineados con colección)
USUARIO_SUB="550e8400-e29b-41d4-a716-446655440000"
REPARTIDOR_SUB="550e8400-e29b-41d4-a716-446655440001"
ADMIN_SUB="550e8400-e29b-41d4-a716-446655440002"

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
  "jti":f"curl-{role}-{now}",
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
echo "ACCESS_TOKEN_SECRET=<hidden>"

TOK_USR="$(make_jwt "$USUARIO_SUB" "usuario")"
TOK_REP="$(make_jwt "$REPARTIDOR_SUB" "repartidor")"
TOK_ADM="$(make_jwt "$ADMIN_SUB" "admin")"

# 1) Setup
request "Base URL Configuration (Swagger)" \
	-X GET "$BASE_URL/swagger/v1/swagger.json"

# 2) User endpoints
request "POST /api/profiles (usuario)" \
	-X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-d '{"tipo":"usuario","nombre":"Juan Pérez García","telefono":"+34912345678","direccion":"Calle Principal 123, 28001 Madrid"}'

request "GET /api/profiles/me (usuario)" \
	-X GET "$BASE_URL/api/profiles/me" \
	-H "Authorization: Bearer $TOK_USR"

request "PATCH /api/profiles/me (usuario)" \
	-X PATCH "$BASE_URL/api/profiles/me" \
	-H "Authorization: Bearer $TOK_USR" \
	-H "Content-Type: application/json" \
	-d '{"nombre":"Juan Pérez García (Updated)","telefono":"+34912345999"}'

request "GET /api/profiles/me/availability (repartidor)" \
	-X GET "$BASE_URL/api/profiles/me/availability" \
	-H "Authorization: Bearer $TOK_REP"

request "POST /api/profiles (repartidor)" \
	-X POST "$BASE_URL/api/profiles" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-d '{"tipo":"repartidor","nombre":"Repartidor Manual","telefono":"+573004445566","direccion":"Calle 2"}'

request "POST /api/profiles/me/availability (repartidor)" \
	-X POST "$BASE_URL/api/profiles/me/availability" \
	-H "Authorization: Bearer $TOK_REP" \
	-H "Content-Type: application/json" \
	-d '{"disponible":true}'

# IDs para admin/internal
ME_USR_RAW="$(curl -sS -X GET "$BASE_URL/api/profiles/me" -H "Authorization: Bearer $TOK_USR")"
ME_REP_RAW="$(curl -sS -X GET "$BASE_URL/api/profiles/me" -H "Authorization: Bearer $TOK_REP")"
USR_PROFILE_ID="$(extract_field "$ME_USR_RAW" "id")"
REP_PROFILE_ID="$(extract_field "$ME_REP_RAW" "id")"

echo
echo "Resolved IDs:"
echo "  usuario profile id: ${USR_PROFILE_ID:-<none>}"
echo "  repartidor profile id: ${REP_PROFILE_ID:-<none>}"

# 3) Admin endpoints
request "GET /api/profiles (admin)" \
	-X GET "$BASE_URL/api/profiles?tipo=usuario&isActive=true&limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_ADM"

if [[ -n "$USR_PROFILE_ID" ]]; then
	request "GET /api/profiles/{profileId} (admin)" \
		-X GET "$BASE_URL/api/profiles/$USR_PROFILE_ID" \
		-H "Authorization: Bearer $TOK_ADM"

	request "PATCH /api/profiles/{profileId} (admin)" \
		-X PATCH "$BASE_URL/api/profiles/$USR_PROFILE_ID" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "Content-Type: application/json" \
		-d '{"nombre":"Updated by Admin","telefono":"+573001110000"}'

	request "POST /api/profiles/{profileId}/activate (admin)" \
		-X POST "$BASE_URL/api/profiles/$USR_PROFILE_ID/activate" \
		-H "Authorization: Bearer $TOK_ADM"

	request "POST /api/profiles/{profileId}/deactivate (admin)" \
		-X POST "$BASE_URL/api/profiles/$USR_PROFILE_ID/deactivate" \
		-H "Authorization: Bearer $TOK_ADM"

	request "DELETE /api/profiles/{profileId} (admin)" \
		-X DELETE "$BASE_URL/api/profiles/$USR_PROFILE_ID" \
		-H "Authorization: Bearer $TOK_ADM"
else
	echo
	echo "[WARN] Skipping admin profileId endpoints: usuario profile id not resolved"
fi

# 4) Internal endpoints (gateway)
request "GET /api/profiles/delivery (internal)" \
	-X GET "$BASE_URL/api/profiles/delivery?limit=10&offset=0&onlyAvailable=true" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-client: gateway"

request "GET /api/profiles/search (internal)" \
	-X GET "$BASE_URL/api/profiles/search?tipo=repartidor&disponible=true&limit=10&offset=0" \
	-H "Authorization: Bearer $TOK_ADM" \
	-H "x-client: gateway"

if [[ -n "$REP_PROFILE_ID" ]]; then
	request "POST /api/profiles/{profileId}/reserve (internal)" \
		-X POST "$BASE_URL/api/profiles/$REP_PROFILE_ID/reserve" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-client: gateway" \
		-H "Content-Type: application/json" \
		-d '{"ttlSeconds":300}'

	request "POST /api/profiles/{profileId}/release (internal)" \
		-X POST "$BASE_URL/api/profiles/$REP_PROFILE_ID/release" \
		-H "Authorization: Bearer $TOK_ADM" \
		-H "x-client: gateway"
else
	echo
	echo "[WARN] Skipping reserve/release: repartidor profile id not resolved"
fi

echo
echo "Done. Curl clone suite finished."
