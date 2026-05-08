# NexTool — Claude Code Context

## Project Overview
NexTool adalah project management tool internal milik CBQA Global Group / Nexora.
URL production: **https://nextools.nexoratech.co**
API production: **https://api-nextools.nexoratech.co**

---

## Tech Stack

### Frontend (`auth-client/`)
- React 18 + TypeScript + Vite
- Tailwind CSS v4 (via `@import "tailwindcss"`)
- React Router v6
- Axios (`src/api/`)
- SheetJS / xlsx (Excel export)
- Lucide React (icons)

### Backend (`auth-service/`)
- Go + Gin framework
- GORM + PostgreSQL
- JWT authentication (`middleware.AuthRequired()`)
- AutoMigrate (additive only — never drops columns)
- Port: `8090` (env `SERVER_PORT`)

### Infrastructure
- Docker Compose (VPS): `nextools-frontend` (nginx), `nextools-backend` (golang:1.24), `nextools-db` (postgres:16)
- Traefik reverse proxy + TLS
- CI/CD: GitHub Actions → SSH deploy → `git reset --hard` + `npm run build` + `docker compose restart`
- DB volume: `nextools-db-data` (persistent, never recreated on deploy)

---

## Repository Structure

```
NEXTOOLS/
├── auth-client/          # React frontend
│   ├── src/
│   │   ├── api/          # Axios API wrappers (tasks, projects, users, members)
│   │   ├── components/   # Layout, Skeleton, Toast
│   │   ├── context/      # AuthContext, useAuth
│   │   ├── pages/        # DashboardPage, ProjectDetailPage, ProjectsPage, UsersPage
│   │   └── types/        # index.ts — all shared TypeScript types
│   └── nginx.conf
├── auth-service/         # Go backend
│   ├── cmd/main.go       # Entry point, all routes wired here
│   └── internal/
│       ├── database/     # db.go — Connect() + Migrate()
│       ├── handler/      # HTTP handlers (one file per resource)
│       ├── middleware/   # AuthRequired, AdminOnly, ProjectMemberOnly
│       ├── model/        # GORM models + request/response types
│       ├── repository/   # DB queries
│       └── service/      # Business logic
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

---

## Database Models

| Table | Key Fields |
|---|---|
| `users` | id, name, email, password (hashed), role (admin/user), is_active |
| `projects` | id, name, description, owner_id |
| `project_members` | project_id, user_id, role (owner/member) |
| `tasks` | id, title, description, category, status, priority, due_date, assignee_id, creator_id, parent_task_id, project_id |
| `task_history` | id, task_id, user_id, action, field, old_value, new_value |
| `task_time_logs` | id, task_id, user_id, clock_in, clock_out, duration (seconds) |
| `task_attachments` | id, task_id, filename, mime_type, data (base64 text) |
| `column_configs` | project_id, labels (JSON), custom_cols (JSON) |

**Task status values:** `backlog`, `todo`, `in_progress`, `in_review`, `done`
**Task priority values:** `low`, `medium`, `high`, `urgent`

---

## API Routes

All protected routes require `Authorization: Bearer <token>` header.

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users
PUT    /api/users/:id
DELETE /api/users/:id          (admin only)

POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/members
POST   /api/projects/:id/members
DELETE /api/projects/:id/members/:userID

POST   /api/projects/:id/tasks
GET    /api/projects/:id/tasks
GET    /api/projects/:id/column-config
PUT    /api/projects/:id/column-config

GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/tasks/:id/history
POST   /api/tasks/:id/clock-in
POST   /api/tasks/:id/clock-out
GET    /api/tasks/:id/time-logs
POST   /api/tasks/:id/time-logs
DELETE /api/tasks/:id/time-logs/:logId
POST   /api/tasks/:id/attachments
GET    /api/tasks/:id/attachments
DELETE /api/tasks/:id/attachments/:attachmentId

GET    /api/me/time-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
GET    /api/me/active-log
GET    /api/time-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
GET    /api/projects/:id/active-logs
```

---

## Frontend Architecture

### Shared Components
- `Layout.tsx` — sidebar (collapsible, localStorage persist), header, mobile nav
- `Toast.tsx` — `ToastProvider` + `useToast()` hook. Bottom-right toast dengan progress bar. Variants: `success`, `error`, `info`. **Selalu pakai `useToast()`, jangan buat toast lokal.**
- `Skeleton.tsx` — `Bone`, `Spinner`, `ProjectCardSkeleton`, `BoardColumnSkeleton`, `DashboardStatSkeleton`, `DashboardRowSkeleton`, `TabContentSkeleton`

### Key Pages
- `DashboardPage` — dua tab: **Overview** (metrics, project health full-width, distribusi status/prioritas, overdue table, semua task) dan **Team Workload** (beban kerja tim grid, team workload time logs week/month + Excel export, time tracking calendar)
- `ProjectDetailPage` — Kanban board, task detail panel (slide-in), task form modal, members panel
- `ProjectsPage` — project grid
- `UsersPage` — user management (admin only untuk delete)

### Patterns
- **RBAC:** `user.role === 'admin'` untuk admin actions. `canEditTask` = admin OR creator OR assignee.
- **Debounce status update:** `statusTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())` — 600ms delay.
- **Lazy tab loading:** `loadedTabsRef = useRef<Set<string>>(new Set())` — tab hanya di-fetch sekali.
- **Board pagination:** `colPage` state + `PAGE_SIZE = 10` per kolom.
- **Optimistic UI:** status change di-update state lokal dulu, rollback kalau API gagal.
- **Active clock-in state:** `activeLogs` (per project) + `myActiveLog` (current user) di-fetch paralel via `Promise.all`. `myActiveElsewhere` = user sedang aktif di task lain → disable Clock In + tampilkan amber warning banner.

---

## UI Design System

### Dark theme colors
- App background: `bg-slate-950` (`#020617`)
- Board background: `#141925`
- Column background: `#1a2035`
- Card background: `#1e2330`
- Card border: `#2a3147`
- Card hover border: `#3d4f7c`
- Section cards: `bg-slate-900 border border-slate-800`

### Typography conventions
- Page title: `text-2xl font-bold tracking-tight text-white`
- Section header: `text-sm font-semibold text-slate-100 tracking-wide`
- Stat value: `text-3xl font-bold tracking-tight`
- Label/meta: `text-xs text-slate-400`

### Indigo usage — hanya untuk:
- Primary CTA buttons (`bg-indigo-600 hover:bg-indigo-500`)
- Active nav item (`bg-indigo-600/15 text-indigo-300`)
- Section header icons (fungsional, bukan dekoratif)
- Jangan gunakan untuk banner, avatar background, atau dekorasi

### Shadows
- Task cards: `shadow-sm shadow-black/40`
- Board columns: `shadow-md shadow-black/30`
- Section cards: `shadow-sm shadow-black/30`
- MetricCards: `shadow-sm shadow-black/30`

### Animations
- Cards masuk: `animate-fade-in` (CSS: `fade-in 0.2s ease-out`)
- Detail panel: CSS `translate-x` transition (`duration-300`)
- Skeleton: `animate-pulse`
- Active indicator: `animate-pulse` pada dot hijau (clock-in aktif) dan dot amber (warning)

---

## Development Rules

### Backend
- **Jangan drop atau modify kolom existing** — AutoMigrate additive only.
- Field baru di model harus punya `default` GORM tag agar data lama tidak null.
- Enrichment field dari JOIN pakai `gorm:"-"` (tidak disimpan, hanya untuk response).
- Selalu tambah route baru di `cmd/main.go`.

### Frontend
- **Gunakan `useToast()` untuk semua notifikasi** — jangan buat state toast lokal.
- **Tambah `Spinner` di tombol submit** saat ada async action — `disabled` + `opacity-60` saat loading.
- **Gunakan skeleton** saat loading data, bukan teks "Loading...".
- Jangan tambah indigo untuk elemen dekoratif — gunakan slate.
- Attachment paste: ambil hanya 1 item (prefer `image/png`) karena macOS clipboard sering duplikat format.

### Git Workflow
- Branch development: `dev` (push ke sini untuk review)
- Branch production: `main` (merge dari `dev` via PR di GitHub → auto-deploy)
- Remote: `https://github.com/Nexora-Tech-Team/NEXTOOLS`

### Deploy
- Merge PR `dev → main` → GitHub Actions otomatis deploy ke VPS.
- Secrets yang dipakai: `HOST`, `USERNAME`, `SSH_PRIVATE_KEY`, `PORT`.
- Frontend: `npm ci --prefer-offline` + `NODE_OPTIONS=--max-old-space-size=2048 npm run build`.
- Backend + semua container: `docker compose up -d --build` (bukan hanya restart).
- Setelah build: `docker image prune -f` untuk bersihkan image lama.
- Timeout CI: 20 menit (`command_timeout: 30m` di SSH step).
- **Data aman** — PostgreSQL volume persistent, AutoMigrate tidak merusak data.

---

## Production Credentials
Tersimpan di `auth-service/.env` (tidak di-commit). Lihat di VPS: `/root/nexora-node/apps/nextools/auth-service/.env`
