#!/bin/bash

# 🚀 PedidosCampus Docker Compose Setup Helper
# Facilita levantar los servicios con un solo comando

set -e # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.docker"
ENV_EXAMPLE="$PROJECT_ROOT/.env.docker.example"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 PedidosCampus Docker Setup                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función: Verificar Docker
check_docker() {
	echo -e "${YELLOW}📦 Verificando Docker...${NC}"

	if ! command -v docker &>/dev/null; then
		echo -e "${RED}❌ Docker no está instalado${NC}"
		echo "   Descargalo desde: https://www.docker.com/products/docker-desktop"
		exit 1
	fi

	if ! command -v docker compose &>/dev/null; then
		echo -e "${RED}❌ Docker Compose no está instalado${NC}"
		exit 1
	fi

	DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
	COMPOSE_VERSION=$(docker compose version --short)

	echo -e "${GREEN}✅ Docker ${DOCKER_VERSION}${NC}"
	echo -e "${GREEN}✅ Docker Compose ${COMPOSE_VERSION}${NC}"
	echo ""
}

# Función: Configurar variables de entorno
setup_env() {
	echo -e "${YELLOW}🔧 Configurando variables de entorno...${NC}"

	if [ ! -f "$ENV_FILE" ]; then
		if [ ! -f "$ENV_EXAMPLE" ]; then
			echo -e "${RED}❌ No encontrado: $ENV_EXAMPLE${NC}"
			exit 1
		fi

		echo -e "${YELLOW}   Creando .env.docker desde .env.docker.example...${NC}"
		cp "$ENV_EXAMPLE" "$ENV_FILE"
		echo -e "${GREEN}✅ Creado: $ENV_FILE${NC}"

		echo -e "${YELLOW}   ⚠️  Edita .env.docker con tus secretos reales${NC}"
		echo -e "${YELLOW}   nano $ENV_FILE${NC}"
	else
		echo -e "${GREEN}✅ Ya existe: $ENV_FILE${NC}"
	fi

	# Verificar que no esté vacío
	if [ ! -s "$ENV_FILE" ]; then
		echo -e "${RED}❌ .env.docker está vacío${NC}"
		cp "$ENV_EXAMPLE" "$ENV_FILE"
	fi

	echo ""
}

# Función: Ver estado actual
show_status() {
	echo -e "${YELLOW}📊 Estado actual de servicios:${NC}"
	docker compose ps 2>/dev/null || echo "   (Sin servicios corriendo)"
	echo ""
}

# Función: Mostrar menú
show_menu() {
	echo -e "${BLUE}¿Qué querés hacer?${NC}"
	echo ""
	echo -e "  ${GREEN}1${NC}  Levantar servicios (build + start)"
	echo -e "  ${GREEN}2${NC}  Levantar servicios (start sin rebuild)"
	echo -e "  ${GREEN}3${NC}  Ver logs en tiempo real"
	echo -e "  ${GREEN}4${NC}  Ver logs de un servicio específico"
	echo -e "  ${GREEN}5${NC}  Parar servicios"
	echo -e "  ${GREEN}6${NC}  Limpiar todo (down + volúmenes)"
	echo -e "  ${GREEN}7${NC}  Ver estado de servicios"
	echo -e "  ${GREEN}8${NC}  Conectar a base de datos"
	echo -e "  ${GREEN}0${NC}  Salir"
	echo ""
}

# Función: Levantar servicios
start_services() {
	echo -e "${YELLOW}🚀 Levantando servicios con build...${NC}"
	echo ""

	docker compose --env-file "$ENV_FILE" up --build
}

# Función: Levantar sin rebuild
start_services_fast() {
	echo -e "${YELLOW}🚀 Levantando servicios (sin rebuild)...${NC}"
	echo ""

	docker compose --env-file "$ENV_FILE" up
}

# Función: Ver logs
view_logs() {
	echo -e "${YELLOW}📜 Mostrando logs de todos los servicios...${NC}"
	echo -e "${YELLOW}   (Presiona Ctrl+C para salir)${NC}"
	echo ""

	docker compose --env-file "$ENV_FILE" logs -f
}

# Función: Ver logs de servicio específico
view_service_logs() {
	echo ""
	echo -e "${YELLOW}¿Qué servicio?${NC}"
	echo "  1. auth-db"
	echo "  2. auth-service"
	echo "  3. user-db"
	echo "  4. user-service"
	echo ""
	read -p "Selecciona (1-4): " service_choice

	case $service_choice in
	1) SERVICE="auth-db" ;;
	2) SERVICE="auth-service" ;;
	3) SERVICE="user-db" ;;
	4) SERVICE="user-service" ;;
	*)
		echo -e "${RED}❌ Opción inválida${NC}"
		return
		;;
	esac

	echo -e "${YELLOW}📜 Logs de $SERVICE...${NC}"
	echo -e "${YELLOW}   (Presiona Ctrl+C para salir)${NC}"
	echo ""

	docker compose --env-file "$ENV_FILE" logs -f "$SERVICE"
}

# Función: Parar servicios
stop_services() {
	echo -e "${YELLOW}🛑 Parando servicios...${NC}"
	docker compose --env-file "$ENV_FILE" down
	echo -e "${GREEN}✅ Servicios detenidos${NC}"
	echo ""
}

# Función: Limpiar todo
cleanup_all() {
	echo -e "${RED}⚠️  Esto eliminará contenedores, redes Y volúmenes (datos)${NC}"
	read -p "¿Estás seguro? (s/n): " confirm

	if [[ $confirm == "s" || $confirm == "S" ]]; then
		echo -e "${YELLOW}🗑️  Limpiando todo...${NC}"
		docker compose --env-file "$ENV_FILE" down -v
		echo -e "${GREEN}✅ Limpieza completada${NC}"
	else
		echo -e "${YELLOW}Cancelado${NC}"
	fi
	echo ""
}

# Función: Conectar a BD
connect_db() {
	echo ""
	echo -e "${YELLOW}¿A cuál base de datos?${NC}"
	echo "  1. auth-db (puerto 5433)"
	echo "  2. user-db (puerto 5434)"
	echo ""
	read -p "Selecciona (1-2): " db_choice

	case $db_choice in
	1)
		echo -e "${YELLOW}Conectando a auth-db...${NC}"
		docker compose exec auth-db psql -U auth_user -d auth_db
		;;
	2)
		echo -e "${YELLOW}Conectando a user-db...${NC}"
		docker compose exec user-db psql -U user_user -d user_db
		;;
	*)
		echo -e "${RED}❌ Opción inválida${NC}"
		;;
	esac
}

# Main loop
main() {
	check_docker
	setup_env
	show_status

	while true; do
		show_menu
		read -p "Tu opción: " choice

		case $choice in
		1) start_services ;;
		2) start_services_fast ;;
		3) view_logs ;;
		4) view_service_logs ;;
		5) stop_services ;;
		6) cleanup_all ;;
		7) show_status ;;
		8) connect_db ;;
		0)
			echo -e "${BLUE}👋 Chau!${NC}"
			exit 0
			;;
		*)
			echo -e "${RED}❌ Opción inválida${NC}"
			echo ""
			;;
		esac
	done
}

# Ejecutar si se llamó directamente (no sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main
fi
