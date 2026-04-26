#!/bin/bash

##############################################################################
# run-all-tests.sh
# Ejecuta TODOS los tests unitarios de los 5 microservicios
#
# Uso: ./run-all-tests.sh
##############################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES_DIR="$PROJECT_ROOT/microservices"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        EJECUTANDO TODOS LOS TESTS UNITARIOS                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Arrays para tracking
SERVICES=("auth-service" "notificaciones-service" "user-service" "restaurant-service" "order-service" "rating-service")
PASSED=()
FAILED=()

##############################################################################
# 1. AUTH-SERVICE (NestJS + Jest)
##############################################################################
echo -e "${YELLOW}▶ Running auth-service tests (Jest)...${NC}"
if cd "$SERVICES_DIR/auth-service"; then
	if npm test 2>&1 | tee /tmp/auth-tests.log; then
		PASSED+=("auth-service")
		echo -e "${GREEN}✅ auth-service: PASSED${NC}\n"
	else
		FAILED+=("auth-service")
		echo -e "${RED}❌ auth-service: FAILED${NC}\n"
	fi
else
	FAILED+=("auth-service")
	echo -e "${RED}❌ auth-service: Directory not found${NC}\n"
fi

##############################################################################
# 2. NOTIFICACIONES-SERVICE (Vitest)
##############################################################################
echo -e "${YELLOW}▶ Running notificaciones-service tests (Vitest)...${NC}"
if cd "$SERVICES_DIR/notificaciones-service"; then
	if npm test 2>&1 | tee /tmp/notificaciones-tests.log; then
		PASSED+=("notificaciones-service")
		echo -e "${GREEN}✅ notificaciones-service: PASSED${NC}\n"
	else
		FAILED+=("notificaciones-service")
		echo -e "${RED}❌ notificaciones-service: FAILED${NC}\n"
	fi
else
	FAILED+=("notificaciones-service")
	echo -e "${RED}❌ notificaciones-service: Directory not found${NC}\n"
fi

##############################################################################
# 3. USER-SERVICE (.NET xUnit)
##############################################################################
echo -e "${YELLOW}▶ Running user-service tests (.NET)...${NC}"
if cd "$SERVICES_DIR/user-service/Tests"; then
	if dotnet test 2>&1 | tee /tmp/user-tests.log; then
		PASSED+=("user-service")
		echo -e "${GREEN}✅ user-service: PASSED${NC}\n"
	else
		FAILED+=("user-service")
		echo -e "${RED}❌ user-service: FAILED${NC}\n"
	fi
else
	FAILED+=("user-service")
	echo -e "${RED}❌ user-service: Directory not found${NC}\n"
fi

##############################################################################
# 4. RESTAURANT-SERVICE (FastAPI + pytest)
##############################################################################
echo -e "${YELLOW}▶ Running restaurant-service tests (pytest)...${NC}"
if cd "$SERVICES_DIR/restaurant-service"; then
	if python -m pytest tests -v 2>&1 | tee /tmp/restaurant-tests.log; then
		PASSED+=("restaurant-service")
		echo -e "${GREEN}✅ restaurant-service: PASSED${NC}\n"
	else
		FAILED+=("restaurant-service")
		echo -e "${RED}❌ restaurant-service: FAILED${NC}\n"
	fi
else
	FAILED+=("restaurant-service")
	echo -e "${RED}❌ restaurant-service: Directory not found${NC}\n"
fi

##############################################################################
# 5. ORDER-SERVICE (Go)
##############################################################################
echo -e "${YELLOW}▶ Running order-service tests (Go)...${NC}"
if cd "$SERVICES_DIR/order-service"; then
	if go test ./... -v 2>&1 | tee /tmp/order-tests.log; then
		PASSED+=("order-service")
		echo -e "${GREEN}✅ order-service: PASSED${NC}\n"
	else
		FAILED+=("order-service")
		echo -e "${RED}❌ order-service: FAILED${NC}\n"
	fi
else
	FAILED+=("order-service")
	echo -e "${RED}❌ order-service: Directory not found${NC}\n"
fi

##############################################################################
# 6. RATING-SERVICE (Rust + Cargo)
##############################################################################
echo -e "${YELLOW}▶ Running rating-service tests (Cargo)...${NC}"
if cd "$SERVICES_DIR/rating-service"; then
	if cargo test --lib 2>&1 | tee /tmp/rating-tests.log; then
		PASSED+=("rating-service")
		echo -e "${GREEN}✅ rating-service: PASSED${NC}\n"
	else
		FAILED+=("rating-service")
		echo -e "${RED}❌ rating-service: FAILED${NC}\n"
	fi
else
	FAILED+=("rating-service")
	echo -e "${RED}❌ rating-service: Directory not found${NC}\n"
fi

##############################################################################
# RESUMEN FINAL
##############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     RESUMEN DE RESULTADOS                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ ${#PASSED[@]} -eq 6 ]; then
	echo -e "${GREEN}✅ TODOS LOS TESTS PASARON (6/6)${NC}"
	echo ""
	for service in "${PASSED[@]}"; do
		echo -e "  ${GREEN}✓${NC} $service"
	done
	exit 0
else
	echo -e "${RED}❌ ALGUNOS TESTS FALLARON${NC}"
	echo ""
	echo -e "${GREEN}Pasados (${#PASSED[@]}/6):${NC}"
	for service in "${PASSED[@]}"; do
		echo -e "  ${GREEN}✓${NC} $service"
	done
	echo ""
	echo -e "${RED}Fallidos (${#FAILED[@]}/6):${NC}"
	for service in "${FAILED[@]}"; do
		echo -e "  ${RED}✗${NC} $service"
	done
	exit 1
fi
