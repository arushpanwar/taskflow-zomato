# TaskFlow

A full-stack task management system with projects, tasks, authentication, and role-based access control.

---

## 1. Overview

**Stack:**
- **Backend:** Go 1.22 · Chi router · pgx/v5 · golang-migrate · JWT (RS256-compatible HMAC) · slog
- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · React Query v5 · React Router v6 · Headless UI
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose · multi-stage Dockerfiles · Nginx (frontend proxy)

**What it does:**
- Register/login with bcrypt-hashed passwords and 24-hour JWTs
- Create projects; tasks are scoped to projects
- Tasks have status, priority, assignee, and due date
- Board view groups tasks by status with one-click status cycling
- Optimistic UI for status changes (reverts on error)
- Dark mode toggle persisted to localStorage
- Stats endpoint (`GET /projects/:id/stats`) for task counts

---

## 2. Architecture Decisions

### Backend

**Chi over Gin/Echo:** Chi is stdlib-compatible (`net/http` handlers everywhere), has zero dependencies beyond the router itself, and makes middleware composition explicit. It also avoids magic in error handling that Gin's `c.JSON` abstraction can obscure in code review.

**pgx/v5 raw queries over an ORM:** For this scope, raw SQL is clearer, faster, and avoids the impedance mismatch of mapping a Go ORM to PostgreSQL enums. Every query is readable at a glance. I would add a repository abstraction layer in production to enable unit testing with mocks, but for a take-home the handler→DB directness keeps things reviewable.

**Embedded migrations:** SQL files are embedded into the binary with `//go:embed`, and `golang-migrate` runs them on startup. This means zero manual migration steps — `docker compose up` handles everything. Down migrations are included for every file.

**`created_by` on tasks:** The spec says "project owner or task creator" can delete a task, which requires knowing who created it. I added this field since the spec explicitly says "you may add fields."

**No refresh tokens:** The spec asks for 24-hour JWTs. Adding refresh tokens without being asked would be scope creep. The 401 handler in the API client redirects to `/login` automatically.

### Frontend

**React Query over Redux/Zustand:** All server state lives in React Query. Only auth state lives in context (because it's client-only, persisted to localStorage). This avoids the boilerplate of a global store for something that is fundamentally async remote data.

**Tailwind + Headless UI over a component library:** I chose not to use shadcn/ui because it generates files into your project and requires a specific setup dance that can be flaky in Docker. Tailwind with custom `@layer components` utilities gives the same result with full control. Headless UI provides accessible modal and transition primitives without styling opinions.

**Optimistic UI on status change:** Clicking the status icon on a task card immediately updates the UI and queues an API call. On error, the previous state is restored via React Query's `onMutate`/`onError` pattern. This was explicitly required in the spec.

### What I intentionally left out

- **Refresh tokens:** Overkill for 24-hour JWTs at this scope
- **Pagination:** Implemented the stats bonus instead; pagination is straightforward to add with a `?page=&limit=` query param
- **WebSockets/SSE:** Would require significant backend scaffolding; out of scope for the time budget
- **Tests:** Included the stats bonus endpoint instead; I would normally add integration tests against a test database using `testcontainers-go`

---

## 3. Running Locally

> Requires: Docker Desktop (or Docker Engine + Compose plugin)

```bash
git clone https://github.com/arushpanwar/taskflow
cd taskflow

# Copy env file — the defaults work out of the box
cp .env.example .env

# Build and start everything (postgres + backend + frontend)
docker compose up --build
```

The app will be available at **http://localhost:3000**

- API: http://localhost:8080
- PostgreSQL: localhost:5432

On first run, Docker downloads base images, builds both stages, and runs migrations. Subsequent starts are fast (layers are cached).

To stop:
```bash
docker compose down
```

To wipe the database volume:
```bash
docker compose down -v
```

---

## 4. Running Migrations

Migrations run **automatically on backend startup**. No manual steps needed.

If you want to run them against a local database manually:

```bash
# Install golang-migrate CLI
brew install golang-migrate

# Run up migrations
migrate -path backend/migrations -database "postgres://postgres:password@localhost:5432/taskflow?sslmode=disable" up

# Roll back
migrate -path backend/migrations -database "postgres://postgres:password@localhost:5432/taskflow?sslmode=disable" down
```

### Seed Data

To load seed data after the app is running:

```bash
docker compose exec postgres psql -U postgres -d taskflow -f /dev/stdin < backend/seed.sql
```

Or copy the file into the container first:
```bash
docker cp backend/seed.sql taskflow-postgres-1:/seed.sql
docker compose exec postgres psql -U postgres -d taskflow -f /seed.sql
```

---

## 5. Test Credentials

After loading seed data:

```
Email:    test@example.com
Password: password123

Email:    alice@example.com
Password: password123
```

The seed also creates a project "Website Redesign" with 3 tasks (todo, in_progress, done).

---

## 6. API Reference

### Auth

**POST /auth/register**
```json
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }

// Response 201
{ "token": "<jwt>", "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com", "created_at": "..." } }
```

**POST /auth/login**
```json
// Request
{ "email": "jane@example.com", "password": "secret123" }

// Response 200 — same shape as register
```

All subsequent endpoints require:
```
Authorization: Bearer <token>
```

---

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects you own or have tasks in |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Project details + tasks |
| PATCH | `/projects/:id` | Update name/description (owner only) |
| DELETE | `/projects/:id` | Delete project + tasks (owner only) |
| GET | `/projects/:id/stats` | Task counts by status and assignee |

**POST /projects**
```json
// Request
{ "name": "Q2 Redesign", "description": "Optional" }

// Response 201
{ "id": "uuid", "name": "Q2 Redesign", "description": "Optional", "owner_id": "uuid", "created_at": "..." }
```

**GET /projects/:id/stats**
```json
// Response 200
{
  "total": 5,
  "by_status": { "todo": 2, "in_progress": 2, "done": 1 },
  "by_assignee": { "Jane Doe": 3, "Unassigned": 2 }
}
```

---

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/tasks` | List tasks, supports `?status=` and `?assignee=` |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task fields |
| DELETE | `/tasks/:id` | Delete (owner or creator only) |

**POST /projects/:id/tasks**
```json
// Request
{
  "title": "Build nav",
  "description": "Optional",
  "priority": "high",
  "assignee_id": "uuid-or-null",
  "due_date": "2026-04-30"
}

// Response 201 — task object
```

**PATCH /tasks/:id**
```json
// Request — all fields optional
{
  "title": "Updated title",
  "status": "done",
  "priority": "low",
  "assignee_id": "uuid",
  "due_date": "2026-05-01"
}
// Response 200 — updated task object
```

---

### Error shapes

```json
// 400
{ "error": "validation failed", "fields": { "email": "is required" } }

// 401
{ "error": "unauthorized" }

// 403
{ "error": "forbidden" }

// 404
{ "error": "not found" }
```

---

## 7. What I'd Do With More Time

**Tests:** The biggest gap. I'd add integration tests using `testcontainers-go` that spin up a real Postgres instance — specifically covering auth flows, the authorization checks (403 vs 401), and concurrent task updates. I'd add React Testing Library tests for the optimistic UI revert path since that's the trickiest piece.

**Proper assignee UX:** Right now the assignee field in the task modal takes a raw UUID. In a real product this would be a combobox searching project members. I'd add a `GET /projects/:id/members` endpoint returning users who have tasks in the project, and use that to populate a dropdown.

**Pagination:** List endpoints currently return all results. For large projects this needs `?page=&limit=` with a `meta.total` in the response. The SQL is straightforward (`LIMIT/OFFSET` or keyset); I skipped it to focus on the stats bonus.

**Refresh tokens:** The current 24-hour JWT means users get silently logged out. A short-lived access token + long-lived refresh token (stored in httpOnly cookie) is the right production approach.

**Row-level security:** I'm doing authorization checks in Go handlers. An alternative is PostgreSQL RLS policies, which is more robust but harder to reason about at this codebase size. I'd revisit this if the team has Postgres expertise.

**Drag-and-drop:** Would use `@dnd-kit/core` to drag tasks between status columns. The optimistic update pattern is already in place (status mutation uses `onMutate`), so the plumbing is there — just need the DnD event handlers.

**Config validation on startup:** Currently the server exits if `JWT_SECRET` is empty but doesn't validate `DATABASE_URL` format. I'd add a startup config validation step that fails fast with clear messages.
