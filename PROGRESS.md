# PROGRESS.md

Tracks build state across sessions. Read this before writing any code in a new session.
See brief Section 0 for the full session-continuity protocol.

---

## Current status

**Last completed step**: Step 3 — Groups + group memberships CRUD
**Next step**: Step 4 — Manual expense creation (all 4 split types)
**Awaiting**: Human confirmation to proceed to Step 4

---

## Step completion log

| Step | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | Scaffold Django + Vite + whitenoise + Render deploy | ✅ Complete | `feat: scaffold Django+DRF+Vite, wire whitenoise, add full schema models` |
| 2 | Auth (login/signup, DRF TokenAuthentication) | ✅ Complete | `feat: auth endpoints register/login/logout/me + React auth UI` |
| 3 | Groups + group memberships CRUD (with join/leave dates) | ✅ Complete | `feat: groups and memberships CRUD with join/leave dates` |
| 4 | Manual expense creation (all 4 split types) | ⬜ Not started | — |
| 5 | Balance calculation (net balances) + drill-down view | ⬜ Not started | — |
| 6 | Settlement recording | ⬜ Not started | — |
| 7 | CSV import: parsing + formatting/date/currency rules (#1,2,6–8,11) | ⬜ Not started | — |
| 8 | CSV import: semantic anomaly rules (#3–5,9,10,12–16) + import report UI | ⬜ Not started | — |
| 9 | End-to-end import of real CSV, verify balances, fix issues | ⬜ Not started | — |
| 10 | UI polish + finalize deployment | ⬜ Not started | — |
| 11 | Finalize README, SCOPE, DECISIONS, AI_USAGE | ⬜ Not started | — |

---

## Step 3 — What was built

### Backend Group & Membership CRUD
- Created Group and GroupMembership serializers and viewsets (`GET/POST /api/groups/`, `GET/PUT/PATCH/DELETE /api/groups/<id>/`, `GET/POST /api/groups/<id>/members/`, `GET/PUT/PATCH/DELETE /api/groups/<id>/members/<id>/`).
- Added User listing endpoint (`GET /api/auth/users/`) to fetch registered users.
- Implemented API validation:
  - Join/leave date checks (`joined_at <= left_at`).
  - Strict interval uniqueness (a user can have at most one active interval in a group).
- Created comprehensive unit tests in `groups/tests.py` testing the `covers_date` method and all validation constraints.

### Frontend Groups Tab
- Wired up a React-based groups management interface within `DashboardPage.jsx`.
- Supports creating a group, listing group members, adding members by choosing from a dynamically fetched user list, updating joined/left dates, and removing memberships.
- Displays validation errors from the Django backend.

---

## Step 1 — What was built

### Backend scaffold
- Django project: `backend/spreetail/` (settings, urls, wsgi, asgi)
- Django apps created: `accounts`, `groups`, `expenses`, `imports`
- All 8 schema tables defined as Django models (see SCOPE.md for full schema)
- `AUTH_USER_MODEL = 'accounts.User'` (AbstractUser extension)
- whitenoise middleware wired to serve `frontend/dist/`
- Catch-all URL pattern serves React's `index.html` for client-side routing
- `dj-database-url` reads `DATABASE_URL` env var → connects to Render Postgres
- `requirements.txt` with all Python deps
- `render.yaml` with build + start commands

### Frontend scaffold
- Vite + React app in `frontend/`
- Hello-world page confirming Django → whitenoise → React pipeline works
- `vite.config.js` sets `outDir: '../backend/staticfiles_src'` (see note below)

### Documentation
- `DECISIONS.md` — D-001 through D-007 populated
- `PROGRESS.md` (this file) — updated
- `SCOPE.md` — stub created, to be filled with anomaly catalog as steps 7–9 complete
- `AI_USAGE.md` — stub created

### Deviations from brief
- None for Step 3.

---

## Open questions / pending decisions

- `expenses_export.csv` not yet present. Will be placed at
  `backend/imports/fixtures/expenses_export.csv` by human before Step 7.
- Render Postgres connection string: must be added as `DATABASE_URL` environment
  variable in Render dashboard after first deploy.
- GitHub repo `spreetail-shared-expenses` must be created and remote set before
  pushing this commit.

