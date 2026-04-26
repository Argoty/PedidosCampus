# Scripts de Automatización - PedidosCampus

Este directorio contiene scripts útiles para ejecutar tests y visualizar diagramas ERD.

## 📋 Scripts Disponibles

### 1. `run-all-tests.sh` - Ejecutar Todos los Tests

Ejecuta **todos los tests unitarios** de los 5 microservicios en secuencia.

#### Uso
```bash
./run-all-tests.sh
```

#### Qué hace
- ✅ Ejecuta tests de **auth-service** (Jest)
- ✅ Ejecuta tests de **notificaciones-service** (Vitest)
- ✅ Ejecuta tests de **user-service** (xUnit .NET)
- ✅ Ejecuta tests de **restaurant-service** (pytest)
- ✅ Ejecuta tests de **order-service** (Go)

#### Salida esperada
Muestra un resumen final indicando cuáles tests pasaron/fallaron:

```
╔════════════════════════════════════════════════════════════════╗
║                     RESUMEN DE RESULTADOS                     ║
╚════════════════════════════════════════════════════════════════╝

✅ TODOS LOS TESTS PASARON (5/5)

  ✓ auth-service
  ✓ notificaciones-service
  ✓ user-service
  ✓ restaurant-service
  ✓ order-service
```

#### Logs
Los logs de cada test se guardan en `/tmp/`:
- `/tmp/auth-tests.log`
- `/tmp/notificaciones-tests.log`
- `/tmp/user-tests.log`
- `/tmp/restaurant-tests.log`
- `/tmp/order-tests.log`
- `/tmp/rating-tests.log`

---

### 2. `view-erds.sh` - Visualizar ERD Diagrams

Levanta **5 servidores live-server** en paralelo para visualizar cada diagrama ERD en el navegador.

#### Requisitos previos
```bash
# Instalar live-server (solo una vez)
npm install -g live-server
```

#### Uso
```bash
./view-erds.sh
```

#### Qué hace
- 🚀 Levanta servidor para **auth-liam-erd** en puerto 3000
- 🚀 Levanta servidor para **usuarios-liam-erd** en puerto 3001
- 🚀 Levanta servidor para **restaurantes-liam-erd** en puerto 3002
- 🚀 Levanta servidor para **pedidos-liam-erd** en puerto 3003
- 🚀 Levanta servidor para **notificaciones-liam-erd** en puerto 3004

Abre automáticamente las 5 URLs en tu navegador.

#### URLs disponibles
| Servicio | URL |
|----------|-----|
| Auth | `http://localhost:3000` |
| Usuarios | `http://localhost:3001` |
| Restaurantes | `http://localhost:3002` |
| Pedidos | `http://localhost:3003` |
| Notificaciones | `http://localhost:3004` |

#### Salida esperada
```
╔════════════════════════════════════════════════════════════════╗
║                    SERVIDORES ACTIVOS                         ║
╚════════════════════════════════════════════════════════════════╝

✅ Todos los ERDs están disponibles:

  1. auth-liam-erd              → http://localhost:3000
  2. usuarios-liam-erd          → http://localhost:3001
  3. restaurantes-liam-erd      → http://localhost:3002
  4. pedidos-liam-erd           → http://localhost:3003
  5. notificaciones-liam-erd    → http://localhost:3004

Abriendo navegador...

⏸ Presiona Ctrl+C para detener todos los servidores
```

#### Parar los servidores
Presiona `Ctrl+C` en la terminal para detener todos los servidores simultáneamente.

---

## 🚀 Flujo de trabajo típico

1. **Ejecutar tests después de cambios**
   ```bash
   ./run-all-tests.sh
   ```

2. **Visualizar esquemas de bases de datos**
   ```bash
   ./view-erds.sh
   # Navega entre las 5 URLs abiertas
   ```

3. **Detener los ERDs cuando termines**
   ```
   Ctrl+C
   ```

---

## 📊 Cobertura de Tests

| Servicio | Framework | Tests | Estado |
|----------|-----------|-------|--------|
| auth-service | Jest | 7 | ✅ |
| notificaciones-service | Vitest | 4 | ✅ |
| user-service | xUnit | 21 | ✅ |
| restaurant-service | pytest | 27 | ✅ |
| order-service | Go | 15 | ✅ |
| rating-service | Cargo | 5 | ✅ |
| **TOTAL** | — | **79** | **✅** |

---

## 🛠 Troubleshooting

### `live-server: comando no encontrado`
```bash
npm install -g live-server
```

### Los puertos 3000-3004 ya están en uso
Modifica los puertos en `view-erds.sh`:
```bash
"auth-liam-erd:3010"          # Cambiar 3000 → 3010
"usuarios-liam-erd:3011"      # Cambiar 3001 → 3011
# ... etc
```

### Tests fallando en algún servicio
1. Revisa los logs: `cat /tmp/auth-tests.log` (reemplaza con el servicio que falla)
2. Navega al directorio del servicio y ejecuta el test manualmente
3. Verifica que las dependencias estén instaladas: `npm install`, `pip install`, `dotnet restore`, etc.

---

## 📝 Notas

- Los scripts están diseñados para ejecutarse desde el directorio `docs/`
- Todos los paths son relativos, así que funcionan desde cualquier lugar del proyecto
- Los scripts tienen colores y emojis para mejor legibilidad
- `run-all-tests.sh` usa `set -e` para detener en el primer error crítico

