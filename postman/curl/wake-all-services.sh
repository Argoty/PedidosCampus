#!/usr/bin/env bash
set -euo pipefail

echo "==============================================="
echo "Wake-up: Hitting all Render services IN PARALLEL"
echo "==============================================="

SERVICES=(
	"https://pedidoscampus-gateway.onrender.com:gateway"
	"https://pedidoscampus-auth.onrender.com:auth-service"
	"https://pedidoscampus-user.onrender.com:user-service"
	"https://pedidoscampus-restaurant.onrender.com:restaurant-service"
	"https://pedidoscampus-order.onrender.com:order-service"
	"https://pedidoscampus-rating.onrender.com:rating-service"
	"https://pedidoscampus-agent.onrender.com:ai-agent-service"
)

wake_one() {
	local url="$1" label="$2"
	local start=$(date +%s)
	local result=""

	# Try up to 12 times (120s total) — Render free tier needs ~30-50s per service
	for i in $(seq 1 12); do
		local code
		code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$url/health" 2>/dev/null || echo "000")
		if [[ "$code" != "000" && "$code" != "502" && "$code" != "503" ]]; then
			local elapsed=$(( $(date +%s) - start ))
			result="✓ $label awake! HTTP $code (${elapsed}s)"
			echo "$result"
			return 0
		fi
		sleep 8  # Esperar entre intentos (no bloquea a otros servicios porque corre en paralelo)
	done
	local elapsed=$(( $(date +%s) - start ))
	result="⚠ $label still down after ${elapsed}s"
	echo "$result"
	return 1
}

echo ""
echo "Firing all wake-up requests in parallel..."
echo ""

PIDS=()
for entry in "${SERVICES[@]}"; do
	url="${entry%:*}"
	label="${entry##*:}"
	(wake_one "$url" "$label") &
	PIDS+=($!)
done

# Esperar a que TODOS terminen
FAILED=0
for pid in "${PIDS[@]}"; do
	wait "$pid" || FAILED=$((FAILED+1))
done

echo ""
echo "==============================================="
if [ "$FAILED" -eq 0 ]; then
	echo "All services awake!"
else
	echo "$FAILED service(s) still down."
fi
echo "==============================================="
