# PROGRESS.md

Tracks build state across sessions. Read this before writing any code in a new session.
See brief Section-0 for the full session-continuity protocol.

---

## Current status

**Last completed step**: Step 7, 8 & 9 — CSV Import pipeline and UI
**Next step**: Step 10 — UI Polish + finalize deployment
**Awaiting**: Human confirmation to proceed to Step 10

---

## Step completion log

| Step | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | Scaffold Django + Vite + whitenoise + Render deploy | ✅ Complete | `feat: scaffold Django+DRF+Vite, wire whitenoise, add full schema models` |
| 2 | Auth (login/signup, DRF TokenAuthentication) | ✅ Complete | `feat: auth endpoints register/login/logout/me + React auth UI` |
| 3 | Groups + group memberships CRUD (with join/leave dates) | ✅ Complete | `feat: groups and memberships CRUD with join/leave dates` |
| 4 | Manual expense creation (all 4 split types) | ✅ Complete | `feat: manual expense creation with all 4 split types and date filter` |
| 5 | Balance calculation (net balances) + drill-down view | ✅ Complete | `feat: live balance calculation, simplified settlements, and audit drill-down` |
| 6 | Settlement recording | ✅ Complete | `feat: live balance calculation, simplified settlements, and audit drill-down` |
| 7 | CSV import: parsing + formatting/date/currency rules (#1,2,6–8,11) | ✅ Complete | `feat: implement full CSV import pipeline, 17 anomaly rules, and report UI` |
| 8 | CSV import: semantic anomaly rules (#3–5,9,10,12–16) + import report UI | ✅ Complete | `feat: implement full CSV import pipeline, 17 anomaly rules, and report UI` |
| 9 | End-to-end import of real CSV, verify balances, fix issues | ✅ Complete | `feat: implement full CSV import pipeline, 17 anomaly rules, and report UI` |
| 10 | UI polish + finalize deployment | ⬜ Not started | — |
| 11 | Finalize README, SCOPE, DECISIONS, AI_USAGE | ⬜ Not started | — |

---

## Step 7, 8 & 9 — What was built

### Backend CSV Import Rules Engine
- Created `ImportUploadView` (`POST /api/imports/upload/`) processing files, mapping headers dynamically, and executing all 17 anomaly detection rules in a single atomic transaction.
- Auto-handles currency (USD conversion at ₹83.50), formats numbers, detects settlements (rerouted as Settlement objects), exact/conflicting duplicates (imported as disputed and flagged), mixed date formats, and ambiguous date parsing.
- Handles name normalization (strip, lowercase, alias mapping for Priya/Rohan).
- Excludes guest Kabir from splits and blocks database row creation for him.
- Filters out non-members or members inactive on transaction dates (`covers_date`) and recomputes splits proportionally (Largest Remainder Method).
- Implemented `/api/imports/<batch_id>/report/` and `/api/imports/anomalies/<id>/resolve/` supporting manual Approve/Reject flows.
- Added 5 new unit tests in `imports/tests.py` verifying Rules 3, 4, 5, 12, and 16. Total test suite is 20 tests.

### Frontend Import UI
- Activated the "Import CSV" sidebar menu navigation.
- Created `ImportsTab` UI featuring drag-and-drop zone, target group selector, and responsive file processing.
- Renders detailed post-import report showing processed rows, total anomalies, and an interactive anomaly audit table.
- Embedded inline action controls: "Approve" (with member dropdown selector for missing payer anomalies) and "Reject" to resolve needs-review anomalies in real time.

---

## Step 5 & 6 — What was built

### Backend Balances & Settlements
- Created `GroupBalancesView` (`GET /api/expenses/groups/<group_id>/balances/`) to compute user balances live from rows.
- Implemented a greedy settlement simplification algorithm (Aisha's view) pairing the largest debtors with largest creditors to produce the minimum set of transactions required to resolve all debts.
- Created `UserBalanceDetailView` (`GET /api/expenses/users/<user_id>/balance-detail/`) providing a complete trace of: expenses paid, shares owed, settlements paid, and settlements received for a specific group (Rohan's audit requirement).
- Created `SettlementListCreateView` (`GET/POST /api/expenses/settlements/`) to record payments with validation.
- Added test case `GroupBalancesAndSettlementsTest` in `expenses/tests.py` verifying balances calculation, simplification matching, and drill-down traces. Total suite is 15 tests.

### Frontend Balances & Settle Up
- Added a Live Balances table in the group details view of [GroupsTab.jsx](file:///c:/Users/pavan/OneDrive/Desktop/spreetail/frontend/src/pages/GroupsTab.jsx).
- Displays the simplified debts list with quick-action "Settle up" shortcuts that pre-fill the sender, recipient, and amount.
- Implemented a Balance Drilldown Verification modal. Clicking on any member's row shows the complete audit trace and formula recap: `Paid - Owed + Settled Paid - Settled Received = Net`.
- Added a Record Settlement form modal.

---

## Step 4 — What was built

### Backend Expense Creation & Splits
- Created Expense serialization and view endpoints (`GET/POST /api/expenses/`, `GET/PUT/PATCH/DELETE /api/expenses/<id>/`) supporting filtering by `group`.
- Implemented core mathematical allocation function using the Largest Remainder Method (Hare-Niemeyer) to handle split rounding residues deterministically.
- Enforced that only members active on the expense date (`GroupMembership.covers_date`) are allowed in splits.
- Automatically handles USD currency conversions at the fixed rate of ₹83.50.
- Formats `share_raw` dynamically based on split types (`equal`, `percentage`, `exact`, `share`).
- Added 7 new unit tests in `expenses/tests.py` verifying each split algorithm and date boundaries, bringing the total suite to 14 tests.

### Frontend Expense Forms
- Created [ExpensesTab.jsx](file:///c:/Users/pavan/OneDrive/Desktop/spreetail/frontend/src/pages/ExpensesTab.jsx) to display a system-wide view of all expenses with expandable drill-down components.
- Integrated group-specific expense listings and a "+ Add Expense" creation modal in [GroupsTab.jsx](file:///c:/Users/pavan/OneDrive/Desktop/spreetail/frontend/src/pages/GroupsTab.jsx).
- Implemented real-time client-side date boundary filtering. When the expense date changes in the date-picker, the active group members list updates immediately.
- Added live target validation checking (percentage sums to 100%, exact sum matches expense amount).
- Enabled sidebar link for "Expenses" in [DashboardPage.jsx](file:///c:/Users/pavan/OneDrive/Desktop/spreetail/frontend/src/pages/DashboardPage.jsx).

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
- `DECISIONS.md` — D-001 through D-008 populated
- `PROGRESS.md` (this file) — updated
- `SCOPE.md` — stub created, to be filled with anomaly catalog as steps 7–9 complete
- `AI_USAGE.md` — stub created

### Deviations from brief
- None for Step 5 & 6.

---

## Open questions / pending decisions

- `expenses_export.csv` not yet present. Will be placed at
  `backend/imports/fixtures/expenses_export.csv` by human before Step 7.
- Render Postgres connection string: must be added as `DATABASE_URL` environment
  variable in Render dashboard after first deploy.
- GitHub repo `spreetail-shared-expenses` must be created and remote set before
  pushing this commit.

