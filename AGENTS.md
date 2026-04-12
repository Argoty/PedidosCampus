# AGENTS.md

## Estado real del repositorio (verificado)
- Este repo **hoy** contiene solo documentación funcional: `docs/RequisitosFuncionales.md`.
- No existen (aún) manifiestos ni configuración ejecutable de código (`package.json`, `pnpm-lock.yaml`, `requirements*.txt`, `go.mod`, `.github/workflows/*`, etc.).
- En consecuencia, **no hay comandos verificables** de build/test/lint para ejecutar en este repo por ahora.

## Fuente de verdad
- Usar `docs/RequisitosFuncionales.md` como base para alcance, requisitos y stack objetivo.
- Si hay conflicto entre futuras docs y configuración ejecutable, priorizar configuración/scripts reales.

## Alcance actual importante para no equivocarse
- La sección “Alcance de la Primera Entrega” define que, para esta fase, los microservicios se presentan **sin conexión entre ellos y sin despliegue en producción**.
- No asumir integración activa entre servicios, RabbitMQ operativo, ni frontend implementado en este repo mientras no existan artefactos ejecutables que lo prueben.

## Guía para futuras sesiones
- Antes de proponer cambios técnicos, verificar si aparecieron nuevos archivos de configuración en raíz o subdirectorios (manifiestos, CI, compose, task runners).
- Si el repo sigue documental, limitarse a cambios de documentación y evitar inventar comandos no verificables.
