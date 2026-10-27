# TaskFlow Pro — GESTCON

Gestor de tareas para equipos de oficina (hasta unas 25 personas) con un módulo adicional
de seguimiento contable mensual por empresa (**Fondo Emprender**).

Resuelve un problema común en equipos pequeños: las tareas viven en chats, correos y hojas de
cálculo, nadie sabe quién tiene carga de más y el seguimiento mensual de cada empresa atendida se
pierde. TaskFlow Pro centraliza tareas, responsables y avance en una sola aplicación con
notificaciones en tiempo real.

> **Proyecto de portafolio.** Todos los datos, nombres de empresas, usuarios y correos son
> **ficticios** y existen solo para demostrar la aplicación.

## Funcionalidades principales

- Tablero Kanban con arrastrar y soltar, vista de lista y calendario.
- Tareas con prioridad, fecha límite, etiquetas, subtareas, comentarios con menciones y tareas recurrentes.
- Varios responsables por tarea, con progreso individual.
- Grupos con líderes y roles (`admin`, `leader`, `member`, `viewer`) con permisos aplicados en el backend.
- Solicitud de eliminación de tareas con aprobación del admin o del líder del grupo.
- Notificaciones en tiempo real (Socket.io) y Web Push; PWA instalable.
- Documentación de la API con Swagger.
- Tablero de carga de trabajo por persona y reportes exportables (PDF / Excel).
- Módulo **Fondo Emprender**: catálogo de empresas, checklist mensual, macroprocesos con responsables, pagos e impuestos.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Recharts, @dnd-kit |
| Backend | Node.js, Express 4, Socket.io, node-cron, web-push |
| Base de datos | PostgreSQL 16 (`pg`) |
| Autenticación | JWT + bcrypt |
| Infraestructura | Docker Compose, Nginx |
| Pruebas | Jest + Supertest (backend), Cypress (E2E) |

## Requisitos

- Node.js 20+ y npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL)

## Instalación y ejecución (con datos de ejemplo)

**Antes de levantar cualquier servicio, copia los archivos de ejemplo de variables de entorno y complétalos:**

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Edita ambos archivos y define `DB_PASSWORD`, `JWT_SECRET` y `JWT_REFRESH_SECRET`
(por ejemplo con `openssl rand -hex 48`). `DB_USER`, `DB_PASSWORD` y `DB_NAME` deben ser
**iguales** en los dos archivos. En `backend/.env` usa `DB_HOST=localhost`.

Luego:

```bash
# 1. Base de datos
docker compose up -d postgres

# 2. Dependencias
npm install
npm run backend:install

# 3. Migraciones + datos de ejemplo
npm run backend:migrate:seed

# 4. Frontend y backend en paralelo
npm run start
```

- Frontend: http://localhost:5173
- API: http://localhost:3000/api · Swagger: http://localhost:3000/api/docs

## Credenciales de demostración

Usuarios de prueba creados por el seed. **Son solo para demostración**; no uses estas
contraseñas fuera de un entorno local.

| Email | Contraseña | Rol |
|---|---|---|
| maria@example.com | admin123 | admin |
| carlos@example.com | leader123 | leader |
| ana@example.com | member123 | member |
| pedro@example.com | member123 | member |
| laura@example.com | viewer123 | viewer |

> Si el login falla con credenciales correctas, ejecuta `localStorage.clear()` en la consola del navegador.

## Comandos útiles

```bash
npm run build            # build de producción
npm run lint             # ESLint (falla con warnings)
npm run backend:test     # pruebas del backend (Jest)
npm run e2e              # Cypress interactivo
./scripts/backup.sh      # backup de BD y configuración
./scripts/reset-db.sh    # resetear BD (destructivo)
docker compose down      # detener contenedores
```

## Documentación

- [`docs/ESTADO_PROYECTO.md`](docs/ESTADO_PROYECTO.md) — estado actual e implementación detallada
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — arquitectura del sistema
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — guía de despliegue
- [`docs/N8N_SETUP.md`](docs/N8N_SETUP.md) — automatizaciones con n8n
- [`docs/SETUP_MACOS.md`](docs/SETUP_MACOS.md) — puesta en marcha en macOS
- [`docs/PROYECTO.md`](docs/PROYECTO.md) — descripción de la fase 1 original (referencia histórica)
