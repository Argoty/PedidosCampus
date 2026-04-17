# Curl clones — manual tests

Clones 1:1 de pruebas de colecciones Postman, ejecutables en consola.

## Archivo

- `user-service.manual-tests.sh`
- `restaurant-service.manual-tests.sh`
- `order-service.manual-tests.sh`

## Uso

```bash
chmod +x postman/curl/user-service.manual-tests.sh
postman/curl/user-service.manual-tests.sh
postman/curl/restaurant-service.manual-tests.sh
postman/curl/order-service.manual-tests.sh
```

## Variables opcionales

```bash
BASE_URL=http://localhost:5000 \
ACCESS_TOKEN_SECRET=dev_access_token_secret_123_very_secret \
postman/curl/user-service.manual-tests.sh

BASE_URL=http://localhost:8001 \
SECRET_KEY=dev_access_token_secret_123_very_secret \
postman/curl/restaurant-service.manual-tests.sh

BASE_URL=http://localhost:8002 \
JWT_SECRET=dev_access_token_secret_123_very_secret \
postman/curl/order-service.manual-tests.sh
```

## Qué cubre

- Setup (Swagger)
- User endpoints (`/me`, create, patch, availability)
- Admin endpoints (`list`, `get by id`, `patch`, `activate`, `deactivate`, `delete`)
- Internal endpoints (`delivery`, `search`, `reserve`, `release` + `x-client: gateway`)
- Order endpoints (`/orders`, `/orders/{id}`, `/orders/{id}/accept`, `/orders/{id}/status`, `/orders/active`, `/orders/deliverer/{id}`)

## Nota

- User script genera JWT HS256 en runtime con `ACCESS_TOKEN_SECRET`.
- Restaurant script genera JWT HS256 en runtime con `SECRET_KEY`.
- Order script genera JWT HS256 en runtime con `JWT_SECRET`.
- Si secreto runtime no coincide, endpoints protegidos devuelven `401`.
