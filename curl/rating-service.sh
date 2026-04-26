#!/bin/bash

# Rating Service - Curl Tests
# Colección completa para testing del microservicio de calificaciones
# Variables reutilizables

BASE_URL="http://localhost:8003"
USER_ID="550e8400-e29b-41d4-a716-446655440000"
RESTAURANTE_ID="650e8400-e29b-41d4-a716-446655440001"
REPARTIDOR_ID="750e8400-e29b-41d4-a716-446655440002"
PEDIDO_ID="850e8400-e29b-41d4-a716-446655440003"
PEDIDO_ID_2="860e8400-e29b-41d4-a716-446655440004"
PEDIDO_ID_3="870e8400-e29b-41d4-a716-446655440005"

RATING_ID=""
RATING_DELIVERY_ID=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Function to print test header
test_header() {
	echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Function to check response
check_response() {
	local test_name=$1
	local response=$2
	local expected_code=$3

	local http_code=$(echo "$response" | tail -n1)

	if [ "$http_code" = "$expected_code" ]; then
		echo -e "${GREEN}✓ PASS${NC}: $test_name (HTTP $http_code)"
		((PASS++))
		return 0
	else
		echo -e "${RED}✗ FAIL${NC}: $test_name (Expected HTTP $expected_code, got $http_code)"
		echo "Response: $(echo "$response" | head -n-1)"
		((FAIL++))
		return 1
	fi
}

# Function to extract ID from JSON response
extract_id() {
	echo "$1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# ============================================
# HEALTH CHECK
# ============================================
test_header "HEALTH CHECK"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
check_response "Health Check" "$response" "200"

# ============================================
# RESTAURANT RATINGS
# ============================================
test_header "RESTAURANT RATINGS - CREATE"

response=$(curl -s -X POST "$BASE_URL/ratings/restaurant" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID'",
    "restaurante_id": "'$RESTAURANTE_ID'",
    "estrellas": 5,
    "comentario": "Excelente comida, servicio rápido y muy atenta el personal"
  }')

if check_response "Create Restaurant Rating" "$response" "201"; then
	RATING_ID=$(extract_id "$response")
	echo "Captured Rating ID: $RATING_ID"
fi

# ============================================
# RESTAURANT RATINGS - GET BY ID
# ============================================
test_header "RESTAURANT RATINGS - GET BY ID"

if [ -n "$RATING_ID" ]; then
	response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/restaurant/$RATING_ID")
	check_response "Get Restaurant Rating by ID" "$response" "200"
else
	echo -e "${RED}✗ SKIP${NC}: Get Rating (No ID available)"
fi

# ============================================
# RESTAURANT RATINGS - CREATE MULTIPLE FOR STATS
# ============================================
test_header "RESTAURANT RATINGS - CREATE MULTIPLE"

# Create 2nd rating
response=$(curl -s -X POST "$BASE_URL/ratings/restaurant" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID_2'",
    "restaurante_id": "'$RESTAURANTE_ID'",
    "estrellas": 4,
    "comentario": "Muy buen servicio, comida excelente"
  }')
check_response "Create 2nd Restaurant Rating" "$response" "201"

# Create 3rd rating
response=$(curl -s -X POST "$BASE_URL/ratings/restaurant" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID_3'",
    "restaurante_id": "'$RESTAURANTE_ID'",
    "estrellas": 3,
    "comentario": "Está bien, nada excepcional"
  }')
check_response "Create 3rd Restaurant Rating" "$response" "201"

# ============================================
# RESTAURANT RATINGS - LIST BY USER
# ============================================
test_header "RESTAURANT RATINGS - LIST BY USER"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/restaurant/user/$USER_ID?limit=10&offset=0")
check_response "List Restaurant Ratings by User" "$response" "200"

# ============================================
# RESTAURANT RATINGS - LIST BY RESTAURANT
# ============================================
test_header "RESTAURANT RATINGS - LIST BY RESTAURANT"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/restaurant/restaurant/$RESTAURANTE_ID?limit=10&offset=0")
check_response "List Restaurant Ratings by Restaurant" "$response" "200"

# ============================================
# RESTAURANT RATINGS - STATS
# ============================================
test_header "RESTAURANT RATINGS - STATS"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/stats/restaurant/$RESTAURANTE_ID")
check_response "Get Restaurant Stats" "$response" "200"

# ============================================
# RESTAURANT RATINGS - UPDATE
# ============================================
test_header "RESTAURANT RATINGS - UPDATE"

if [ -n "$RATING_ID" ]; then
	response=$(curl -s -X PATCH "$BASE_URL/ratings/restaurant/$RATING_ID" \
		-H "Content-Type: application/json" \
		-w "\n%{http_code}" \
		-d '{
        "estrellas": 4,
        "comentario": "Muy buena comida, pero tardó un poco"
      }')
	check_response "Update Restaurant Rating" "$response" "200"
else
	echo -e "${RED}✗ SKIP${NC}: Update Rating (No ID available)"
fi

# ============================================
# DELIVERY RATINGS
# ============================================
test_header "DELIVERY RATINGS - CREATE"

response=$(curl -s -X POST "$BASE_URL/ratings/delivery" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID'",
    "repartidor_id": "'$REPARTIDOR_ID'",
    "estrellas": 5,
    "comentario": "Entrega rápida y cuidadosa, muy profesional"
  }')

if check_response "Create Delivery Rating" "$response" "201"; then
	RATING_DELIVERY_ID=$(extract_id "$response")
	echo "Captured Delivery Rating ID: $RATING_DELIVERY_ID"
fi

# ============================================
# DELIVERY RATINGS - GET BY ID
# ============================================
test_header "DELIVERY RATINGS - GET BY ID"

if [ -n "$RATING_DELIVERY_ID" ]; then
	response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/delivery/$RATING_DELIVERY_ID")
	check_response "Get Delivery Rating by ID" "$response" "200"
else
	echo -e "${RED}✗ SKIP${NC}: Get Delivery Rating (No ID available)"
fi

# ============================================
# DELIVERY RATINGS - CREATE MULTIPLE FOR STATS
# ============================================
test_header "DELIVERY RATINGS - CREATE MULTIPLE"

# Create 2nd delivery rating
response=$(curl -s -X POST "$BASE_URL/ratings/delivery" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID_2'",
    "repartidor_id": "'$REPARTIDOR_ID'",
    "estrellas": 5,
    "comentario": "Excelente entrega, muy rápido"
  }')
check_response "Create 2nd Delivery Rating" "$response" "201"

# Create 3rd delivery rating
response=$(curl -s -X POST "$BASE_URL/ratings/delivery" \
	-H "Content-Type: application/json" \
	-w "\n%{http_code}" \
	-d '{
    "pedido_id": "'$PEDIDO_ID_3'",
    "repartidor_id": "'$REPARTIDOR_ID'",
    "estrellas": 4,
    "comentario": "Buena entrega, aunque llegó 5 minutos tarde"
  }')
check_response "Create 3rd Delivery Rating" "$response" "201"

# ============================================
# DELIVERY RATINGS - LIST BY USER
# ============================================
test_header "DELIVERY RATINGS - LIST BY USER"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/delivery/user/$USER_ID?limit=10&offset=0")
check_response "List Delivery Ratings by User" "$response" "200"

# ============================================
# DELIVERY RATINGS - LIST BY DELIVERY
# ============================================
test_header "DELIVERY RATINGS - LIST BY DELIVERY"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/delivery/delivery/$REPARTIDOR_ID?limit=10&offset=0")
check_response "List Delivery Ratings by Repartidor" "$response" "200"

# ============================================
# DELIVERY RATINGS - STATS
# ============================================
test_header "DELIVERY RATINGS - STATS"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ratings/stats/delivery/$REPARTIDOR_ID")
check_response "Get Delivery Stats" "$response" "200"

# ============================================
# DELIVERY RATINGS - UPDATE
# ============================================
test_header "DELIVERY RATINGS - UPDATE"

if [ -n "$RATING_DELIVERY_ID" ]; then
	response=$(curl -s -X PATCH "$BASE_URL/ratings/delivery/$RATING_DELIVERY_ID" \
		-H "Content-Type: application/json" \
		-w "\n%{http_code}" \
		-d '{
        "estrellas": 4,
        "comentario": "Buena entrega, aunque llegó 5 minutos tarde"
      }')
	check_response "Update Delivery Rating" "$response" "200"
else
	echo -e "${RED}✗ SKIP${NC}: Update Delivery Rating (No ID available)"
fi

# ============================================
# DELETE RATINGS (Cleanup)
# ============================================
test_header "CLEANUP - DELETE RATINGS"

if [ -n "$RATING_ID" ]; then
	response=$(curl -s -X DELETE "$BASE_URL/ratings/restaurant/$RATING_ID" -w "\n%{http_code}")
	check_response "Delete Restaurant Rating" "$response" "204"
else
	echo -e "${RED}✗ SKIP${NC}: Delete Rating (No ID available)"
fi

if [ -n "$RATING_DELIVERY_ID" ]; then
	response=$(curl -s -X DELETE "$BASE_URL/ratings/delivery/$RATING_DELIVERY_ID" -w "\n%{http_code}")
	check_response "Delete Delivery Rating" "$response" "204"
else
	echo -e "${RED}✗ SKIP${NC}: Delete Delivery Rating (No ID available)"
fi

# ============================================
# SUMMARY
# ============================================
echo -e "\n${YELLOW}============================================${NC}"
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo -e "${YELLOW}============================================${NC}"
echo -e "${GREEN}PASSED: $PASS${NC}"
echo -e "${RED}FAILED: $FAIL${NC}"

if [ $FAIL -eq 0 ]; then
	echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
	exit 0
else
	echo -e "${RED}✗ SOME TESTS FAILED${NC}"
	exit 1
fi
