#!/bin/bash

##############################################################################
# view-erds.sh
# Levanta un live-server local para cada uno de los 5 ERD diagrams
# Abre automáticamente en el navegador
#
# Uso: ./view-erds.sh
#
# Notas:
#   - Requiere 'live-server' instalado: npm install -g live-server
#   - Levanta 5 servidores en puertos diferentes (3000-3004)
#   - Presionar Ctrl+C para detener todos los servidores
##############################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERD_DIR="$PROJECT_ROOT/docs/diagrams/erd"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           LEVANTANDO LIVE-SERVERS PARA TODOS LOS ERDs         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que live-server esté instalado
if ! command -v live-server &>/dev/null; then
	echo -e "${RED}❌ Error: live-server no está instalado${NC}"
	echo -e "${YELLOW}Instálalo con: npm install -g live-server${NC}"
	exit 1
fi

# Verificar que el directorio exista
if [ ! -d "$ERD_DIR" ]; then
	echo -e "${RED}❌ Error: Directorio $ERD_DIR no encontrado${NC}"
	exit 1
fi

# Directorio de ERDs con sus puertos
declare -a ERDS=(
	"auth-liam-erd:3000"
	"usuarios-liam-erd:3001"
	"restaurantes-liam-erd:3002"
	"pedidos-liam-erd:3003"
	"notificaciones-liam-erd:3004"
)

# Arrays para tracking de PIDs
declare -a PIDS=()

# Función para cleanup (matar servidores) al salir
cleanup() {
	echo -e "\n${YELLOW}▶ Deteniendo todos los servidores...${NC}"
	for pid in "${PIDS[@]}"; do
		if kill $pid 2>/dev/null; then
			echo -e "${GREEN}✓${NC} Proceso $pid detenido"
		fi
	done
	exit 0
}

# Asignar trap para cleanup
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}Levantando servidores en puertos 3000-3004...${NC}"
echo ""

# Levantar cada servidor en background
for erd_config in "${ERDS[@]}"; do
	ERD_NAME="${erd_config%:*}"
	PORT="${erd_config#*:}"
	ERD_PATH="$ERD_DIR/$ERD_NAME"

	if [ ! -d "$ERD_PATH" ]; then
		echo -e "${RED}⚠ $ERD_NAME: Directorio no encontrado${NC}"
		continue
	fi

	echo -e "${YELLOW}▶ $ERD_NAME${NC}"
	echo -e "  📍 Puerto: $PORT"
	echo -e "  🌐 URL: http://localhost:$PORT"

	# Levantar live-server en background
	cd "$ERD_PATH"
	live-server --port=$PORT --no-browser >/tmp/live-server-$PORT.log 2>&1 &
	PIDS+=($!)

	echo -e "  ${GREEN}✓ Servidor iniciado${NC}"
	echo ""

	sleep 0.5
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SERVIDORES ACTIVOS                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Todos los ERDs están disponibles:${NC}"
echo ""
echo -e "  1. ${CYAN}auth-liam-erd${NC}              → ${CYAN}http://localhost:3000${NC}"
echo -e "  2. ${CYAN}usuarios-liam-erd${NC}          → ${CYAN}http://localhost:3001${NC}"
echo -e "  3. ${CYAN}restaurantes-liam-erd${NC}      → ${CYAN}http://localhost:3002${NC}"
echo -e "  4. ${CYAN}pedidos-liam-erd${NC}           → ${CYAN}http://localhost:3003${NC}"
echo -e "  5. ${CYAN}notificaciones-liam-erd${NC}    → ${CYAN}http://localhost:3004${NC}"
echo ""
echo -e "${YELLOW}Abriendo navegador...${NC}"

# Abrir en navegador (si está disponible)
if command -v xdg-open &>/dev/null; then
	# Linux
	xdg-open http://localhost:3000 >/dev/null 2>&1 || true
	sleep 1
	xdg-open http://localhost:3001 >/dev/null 2>&1 || true
	sleep 1
	xdg-open http://localhost:3002 >/dev/null 2>&1 || true
	sleep 1
	xdg-open http://localhost:3003 >/dev/null 2>&1 || true
	sleep 1
	xdg-open http://localhost:3004 >/dev/null 2>&1 || true
elif command -v open &>/dev/null; then
	# macOS
	open http://localhost:3000
	sleep 1
	open http://localhost:3001
	sleep 1
	open http://localhost:3002
	sleep 1
	open http://localhost:3003
	sleep 1
	open http://localhost:3004
fi

echo ""
echo -e "${YELLOW}⏸  Presiona ${RED}Ctrl+C${NC}${YELLOW} para detener todos los servidores${NC}"
echo ""

# Mantener el script vivo
wait
