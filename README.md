<![CDATA[<div align="center">

# 💸 Spreetail

### Shared Expenses for Flatmates — Built for the Real World

A production-grade expense tracker that handles messy CSV imports, multi-currency conversions, timeline-aware group memberships, and 17 automated anomaly detection rules — all wrapped in a sleek dark-mode UI.

[![Django](https://img.shields.io/badge/Django-4.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com)

**[🌐 Live Demo →](https://splitwise-oq43.onrender.com)**

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [CSV Import & Anomaly Engine](#-csv-import--anomaly-engine)
- [Balance Calculation](#-balance-calculation)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Design Decisions](#-design-decisions)
- [Documentation Index](#-documentation-index)

---

## 🧭 Overview

Spreetail is a **shared expense management application** built for a group of flatmates (Aisha, Rohan, Priya, Meera, Dev, and Sam) tracking real-world expenses from February to April 2026 — including a Goa trip, flatmate transitions, multi-currency payments, and a deliberately messy CSV export.

The system doesn't just record expenses — it **ingests chaotic real-world data**, detects 17 categories of anomalies, auto-corrects what it can, flags what it can't, and produces a fully auditable trail that humans can approve or reject.

---

## ✨ Key Features

### 💰 Expense Management
- **Four split types** — Equal, Percentage, Exact amounts, Share/ratio
- **Multi-currency** — USD ↔ INR conversion at documented fixed rate (₹83.50)
- **Rounding precision** — Largest Remainder Method (Hare-Niemeyer) ensures every paisa adds up

### 👥 Timeline-Aware Groups
- Members have **join/leave dates** — expenses are only split among members active on the transaction date
- **Quick registration** — create new users inline from the Add Member modal
- Meera leaving in March, Sam arriving in April — the system handles it automatically

### 📊 Live Balance Engine
- **Zero stored balances** — every number is computed live from `expense_shares` rows (Rohan's auditability requirement)
- **Greedy settlement simplification** — minimizes the number of payments needed to clear all debts
- **Drill-down verification** — click any balance to see the complete formula trace: `Paid − Owed + Received − Sent = Net`

### 📥 CSV Import Pipeline
- **17 anomaly detection rules** — dates, duplicates, currencies, names, splits, membership windows
- **Intelligent auto-correction** — normalizes formats, resolves aliases, converts currencies, re-routes settlements
- **Human-in-the-loop** — anything the system can't resolve is flagged for manual review with Approve/Reject controls
- **Full auditability** — every original CSV row is preserved as JSON, every decision is logged

### 🤝 Settlement Tracking
- Record direct payments between flatmates
- Settlements detected in CSV are auto-rerouted (anomaly #5)
- Balances update in real time

---

## 🏗 Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Browser"]
        React["React SPA<br/>(Vite build)"]
    end

    subgraph Render["☁️ Render Web Service"]
        subgraph Django["Django 4.2 + DRF"]
            WN["WhiteNoise<br/>Static Files"]
            Auth["accounts<br/>Auth + Users"]
            Groups["groups<br/>Groups + Memberships"]
            Expenses["expenses<br/>Expenses + Shares + Settlements"]
            Imports["imports<br/>CSV Pipeline + Anomalies"]
        end
        Gunicorn["Gunicorn<br/>WSGI Server"]
    end

    subgraph DB["🗄️ PostgreSQL"]
        Tables["8 Tables<br/>0 stored balances"]
    end

    React -->|"HTTPS /api/*"| Gunicorn
    React -->|"HTTPS /*"| WN
    Gunicorn --> Django
    WN -->|"index.html, JS, CSS"| React
    Auth --> Tables
    Groups --> Tables
    Expenses --> Tables
    Imports --> Tables

    style Client fill:#1e1b4b,stroke:#7c3aed,color:#f1f5f9
    style Render fill:#0d1225,stroke:#4338ca,color:#f1f5f9
    style Django fill:#121828,stroke:#7c3aed,color:#f1f5f9
    style DB fill:#0f172a,stroke:#10b981,color:#f1f5f9
```

### Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gunicorn
    participant D as Django/DRF
    participant P as PostgreSQL

    Note over B,P: Authentication Flow
    B->>G: POST /api/auth/login/
    G->>D: Route to LoginView
    D->>P: Verify credentials
    P-->>D: User record
    D-->>B: { token, user }

    Note over B,P: Authenticated API Request
    B->>G: GET /api/expenses/groups/1/balances/<br/>Authorization: Token xxx
    G->>D: TokenAuthentication
    D->>P: Aggregate SUM queries
    P-->>D: Raw totals
    D->>D: Greedy settlement algorithm
    D-->>B: { balances[], suggested_settlements[] }

    Note over B,P: CSV Import Pipeline
    B->>G: POST /api/imports/upload/<br/>multipart/form-data
    G->>D: ImportUploadView
    D->>D: Parse CSV, run 17 rules
    D->>P: Atomic transaction<br/>(expenses + anomalies)
    P-->>D: Created IDs
    D-->>B: { batch_id, row_count, anomaly_count }
```

### Single-Origin Deployment Model

```
┌──────────────────────────────────────────────────────┐
│                   Render Web Service                 │
│                                                      │
│   Gunicorn ──► Django ──► DRF API  (/api/*)          │
│                  │                                   │
│                  ├──► WhiteNoise   (static assets)   │
│                  │     ├── index.html                │
│                  │     ├── assets/index-*.js          │
│                  │     └── assets/index-*.css         │
│                  │                                   │
│                  └──► Catch-all    (→ index.html)    │
│                       (React Router handles it)      │
│                                                      │
│   ┌────────────────────────────────────────────┐     │
│   │  Render Managed PostgreSQL                 │     │
│   │  Connected via DATABASE_URL env var        │     │
│   └────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

> **Why single-origin?** No CORS configuration needed. The React build is served by Django via WhiteNoise as static files. API calls are same-origin `/api/` requests. This eliminates an entire class of deployment bugs.

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend** | Django 4.2 + Django REST Framework | Python excels at CSV parsing and data pipelines. Django ORM provides type-safe aggregation queries for balance calculations. |
| **Frontend** | React 19 (Vite) | Fast builds, HMR in dev. Compiled to static assets for production. |
| **Database** | PostgreSQL 16 | ACID transactions for atomic CSV imports. Robust aggregation for live balance queries. |
| **Auth** | DRF TokenAuthentication | Simple stateless auth. PBKDF2-SHA256 password hashing via Django's native machinery. |
| **Static Files** | WhiteNoise | Serves Vite's compiled output directly from Django — no Nginx or CDN needed for this scope. |
| **WSGI Server** | Gunicorn | Production-grade Python WSGI server on Render. |
| **Deploy** | Render (free tier) | Single web service + managed Postgres. Auto-deploys from `main` branch on push. |

---

## 🗄 Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ group_memberships : "has memberships"
    users ||--o{ expenses : "paid_by"
    users ||--o{ expense_shares : "owes"
    users ||--o{ settlements : "paid_by"
    users ||--o{ settlements : "paid_to"
    users ||--o{ import_batches : "imported_by"

    expense_groups ||--o{ group_memberships : "has members"
    expense_groups ||--o{ expenses : "contains"
    expense_groups ||--o{ settlements : "contains"

    expenses ||--o{ expense_shares : "split into"
    expenses ||--o{ import_anomalies : "linked from"

    import_batches ||--o{ import_anomalies : "contains"
    settlements ||--o{ import_anomalies : "linked from"

    users {
        int id PK
        string name
        string email UK
        string password "PBKDF2-SHA256 hashed"
        datetime created_at
    }

    expense_groups {
        int id PK
        string name
        datetime created_at
    }

    group_memberships {
        int id PK
        int group_id FK
        int user_id FK
        date joined_at
        date left_at "nullable = still active"
    }

    expenses {
        int id PK
        int group_id FK
        int paid_by_id FK
        text description
        date expense_date
        decimal original_amount
        string original_currency "INR or USD"
        decimal fx_rate_to_inr "nullable"
        decimal amount_inr "canonical amount"
        string split_type "equal|percentage|exact|share"
        string status "active|disputed|voided"
        string source "manual|import"
        text notes
    }

    expense_shares {
        int id PK
        int expense_id FK
        int user_id FK
        decimal share_amount_inr
        string share_raw "e.g. 33.33%"
    }

    settlements {
        int id PK
        int group_id FK
        int paid_by_id FK
        int paid_to_id FK
        decimal amount_inr
        datetime settled_at
        string source "manual|import"
        text notes
    }

    import_batches {
        int id PK
        string filename
        datetime imported_at
        int imported_by_id FK
        int row_count
        int anomaly_count
    }

    import_anomalies {
        int id PK
        int batch_id FK
        int source_row_number
        json raw_row "original CSV data"
        string anomaly_type
        text description
        text applied_policy
        string status "auto_handled|needs_review|resolved"
        int linked_expense_id FK "nullable"
        int linked_settlement_id FK "nullable"
    }
```

### Key Schema Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No stored balances** | Every balance is computed via `SUM()` over `expense_shares` and `settlements`. No cache drift. |
| **Full auditability** | Original amounts + currencies preserved. FX rate recorded. `share_raw` explains the math. |
| **Timeline awareness** | `group_memberships.covers_date()` gates every split calculation. |
| **Import traceability** | `import_anomalies.raw_row` stores the entire original CSV row as JSON. |

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register/` | Public | Register a new user → `{ token, user }` |
| `POST` | `/api/auth/login/` | Public | Login → `{ token, user }` |
| `POST` | `/api/auth/logout/` | Token | Invalidate token |
| `GET` | `/api/auth/me/` | Token | Get current authenticated user |
| `GET` | `/api/auth/users/` | Token | List all registered users |

### Groups & Memberships

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/groups/` | List all groups (with nested memberships) |
| `POST` | `/api/groups/` | Create a new group |
| `GET` | `/api/groups/:id/` | Get group detail |
| `PUT/PATCH` | `/api/groups/:id/` | Update group |
| `DELETE` | `/api/groups/:id/` | Delete group |
| `GET` | `/api/groups/:id/members/` | List group memberships |
| `POST` | `/api/groups/:id/members/` | Add member with join/leave dates |
| `PATCH` | `/api/groups/:id/members/:mid/` | Update membership dates |
| `DELETE` | `/api/groups/:id/members/:mid/` | Remove membership |

### Expenses & Splits

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses/?group=:id` | List expenses (filterable by group) |
| `POST` | `/api/expenses/` | Create expense with split allocation |
| `GET` | `/api/expenses/:id/` | Get expense detail with shares |
| `PUT/PATCH` | `/api/expenses/:id/` | Update expense |
| `DELETE` | `/api/expenses/:id/` | Delete expense |

### Balances & Settlements

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses/groups/:id/balances/` | Live computed balances + greedy settlements |
| `GET` | `/api/expenses/users/:id/balance-detail/?group=:gid` | Audit drill-down for one user |
| `GET` | `/api/expenses/settlements/` | List settlements |
| `POST` | `/api/expenses/settlements/` | Record a settlement payment |

### CSV Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/imports/upload/` | Upload CSV file → run anomaly pipeline |
| `GET` | `/api/imports/:batch_id/report/` | Get import report with anomalies |
| `POST` | `/api/imports/anomalies/:id/resolve/` | Approve or reject an anomaly |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health/` | Returns `{ "status": "ok" }` — unauthenticated |

---

## 🔍 CSV Import & Anomaly Engine

The import pipeline processes a real-world CSV file containing 43 expense rows with intentionally messy data. It applies **17 detection rules** in a single atomic database transaction.

### Anomaly Detection Catalogue

| # | Category | Detection Rule | Auto-Resolution |
|---|----------|---------------|-----------------|
| 1 | **Mixed date formats** | Non-ISO date strings (`01/03/2026`, `Mar 14`) | Normalize to ISO `YYYY-MM-DD` |
| 2 | **Ambiguous dates** | DD/MM vs MM/DD ambiguity (`04/05/2026`) | Default DD/MM (Indian locale), flag for review |
| 3 | **Exact duplicates** | Same date + payer + amount + description | Import first, skip second, log both |
| 4 | **Conflicting duplicates** | Same signature, different details | Import both as `disputed` status |
| 5 | **Settlement as expense** | Keywords like "paid back", 1-to-1 split | Re-route to `settlements` table |
| 6 | **USD amounts** | `currency == "USD"` | Convert at ₹83.50, store `fx_rate_to_inr` |
| 7 | **Missing currency** | Currency field blank | Default to INR, flag |
| 8 | **Amount formatting** | `"1,200"`, trailing spaces, symbols | Strip/parse/round to 2 decimal places |
| 9 | **Negative amount** | `amount < 0` | Treat as refund, flag |
| 10 | **Zero amount** | `amount == 0` | Create as `voided` status, flag |
| 11 | **Inconsistent names** | `"priya"`, `"Priya S"`, `"rohan "` | Alias map + whitespace normalization |
| 12 | **Missing payer** | Payer field blank or unresolvable | Mark `needs_review`, no expense created |
| 13 | **Percentage ≠ 100%** | Split percentages don't sum to 100 | Rescale proportionally, flag |
| 14 | **Split type mismatch** | `split_type` contradicts `split_details` | Use details if provided, flag inconsistency |
| 15 | **Non-member in split** | Person not registered as a user | Exclude from split, recompute shares |
| 16 | **Outside membership window** | Member not active on expense date | Exclude from split, recompute shares |
| 17 | **Excluded participant** | Guest (e.g., Kabir) not a registered user | Exclude entirely, log as anomaly |

### Pipeline Flow

```mermaid
flowchart TD
    A["📄 CSV Upload"] --> B["Parse Headers<br/>(dynamic column mapping)"]
    B --> C["Row-by-Row Processing"]

    C --> D{"Date Parsing"}
    D -->|"Non-ISO"| D1["Normalize + flag #1"]
    D -->|"Ambiguous"| D2["Default DD/MM + flag #2"]
    D -->|"ISO"| D3["✓ Use as-is"]

    C --> E{"Duplicate Check"}
    E -->|"Exact"| E1["Skip duplicate + flag #3"]
    E -->|"Conflicting"| E2["Import as disputed #4"]
    E -->|"Unique"| E3["✓ Proceed"]

    C --> F{"Settlement Detection"}
    F -->|"Keywords match"| F1["Re-route to settlements #5"]
    F -->|"Not settlement"| F2["✓ Create expense"]

    C --> G{"Currency & Amount"}
    G --> G1["Format cleanup #8"]
    G --> G2["USD → INR #6"]
    G --> G3["Missing currency → INR #7"]
    G --> G4["Negative → refund #9"]
    G --> G5["Zero → voided #10"]

    C --> H{"Name Resolution"}
    H --> H1["Normalize + alias map #11"]
    H --> H2["Missing payer → needs_review #12"]
    H --> H3["Kabir → excluded #17"]

    C --> I{"Split Validation"}
    I --> I1["% ≠ 100 → rescale #13"]
    I --> I2["Type mismatch → use details #14"]
    I --> I3["Non-member → exclude #15"]
    I --> I4["Outside window → exclude #16"]

    D1 & D2 & D3 & E2 & E3 & F1 & F2 --> J["Atomic DB Transaction"]
    J --> K["ImportBatch + ImportAnomalies<br/>+ Expenses + Shares + Settlements"]

    style A fill:#7c3aed,stroke:#4338ca,color:#fff
    style J fill:#10b981,stroke:#059669,color:#fff
    style K fill:#0d1225,stroke:#7c3aed,color:#f1f5f9
```

---

## ⚖️ Balance Calculation

Balances are **never stored** — they are computed live from underlying rows to satisfy Rohan's auditability requirement.

### The Formula

```
Net Balance = Σ(expenses paid) − Σ(shares owed) + Σ(settlements received) − Σ(settlements paid)
```

- **Positive** → the group owes you money
- **Negative** → you owe the group money

### Greedy Settlement Simplification

The system computes the minimum set of payments to resolve all debts using a greedy algorithm:

```
1. Sort all members by net balance
2. Pair the largest debtor with the largest creditor
3. Transfer min(|debt|, credit)
4. Remove anyone who reaches zero
5. Repeat until all balances clear
```

This reduces potentially N² pairwise debts to at most N−1 transactions.

### Rounding: Largest Remainder Method

When splitting ₹835.00 equally among 3 people:
- Naive: ₹278.33 × 3 = ₹834.99 (₹0.01 missing!)
- **Spreetail**: Allocates the residual paisa to the member with the largest fractional remainder, with user ID as a deterministic tiebreaker. Sum always equals the total.

---

## 📁 Project Structure

```
spreetail/
├── backend/
│   ├── accounts/            # User model (AbstractUser), auth views, serializers
│   │   ├── models.py        #   → User with name, email (unique), created_at
│   │   ├── views.py         #   → RegisterView, LoginView, LogoutView, MeView
│   │   ├── serializers.py   #   → RegisterSerializer, LoginSerializer, UserSerializer
│   │   ├── urls.py          #   → /api/auth/*
│   │   └── tests.py
│   │
│   ├── groups/              # Group management with membership timelines
│   │   ├── models.py        #   → Group, GroupMembership (with covers_date())
│   │   ├── views.py         #   → GroupViewSet, MembershipViewSet
│   │   ├── serializers.py   #   → Nested membership serialization
│   │   ├── urls.py          #   → /api/groups/*
│   │   └── tests.py
│   │
│   ├── expenses/            # Expense tracking, splits, settlements, balances
│   │   ├── models.py        #   → Expense, ExpenseShare, Settlement
│   │   ├── views.py         #   → ExpenseViewSet, GroupBalancesView, SettlementView
│   │   ├── serializers.py   #   → Split allocation logic (Largest Remainder Method)
│   │   ├── urls.py          #   → /api/expenses/*
│   │   └── tests.py
│   │
│   ├── imports/             # CSV import pipeline and anomaly detection
│   │   ├── models.py        #   → ImportBatch, ImportAnomaly (17 anomaly types)
│   │   ├── views.py         #   → ImportUploadView (570+ lines of rules engine)
│   │   ├── urls.py          #   → /api/imports/*
│   │   └── tests.py
│   │
│   ├── spreetail/           # Django project configuration
│   │   ├── settings.py      #   → DB, auth, whitenoise, static files config
│   │   ├── urls.py          #   → Root URL routing + React catch-all
│   │   └── wsgi.py
│   │
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js         # Thin fetch wrapper with Token auth
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx    # React context for auth state
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx      # Login + Registration UI
│   │   │   ├── DashboardPage.jsx # Sidebar + tab navigation shell
│   │   │   ├── GroupsTab.jsx     # Groups, members, expenses, balances, settlements
│   │   │   ├── ExpensesTab.jsx   # System-wide expense browser
│   │   │   └── ImportsTab.jsx    # CSV upload + anomaly review UI
│   │   ├── App.jsx
│   │   └── App.css               # Complete design system (dark mode)
│   ├── vite.config.js
│   └── package.json
│
├── expenses_export.csv      # The messy real-world CSV (43 rows, 17+ anomalies)
├── render.yaml              # Render deployment blueprint
├── DECISIONS.md             # Architectural decision log (D-001 to D-008)
├── SCOPE.md                 # Schema + anomaly catalogue
├── PROGRESS.md              # Step-by-step build progress
└── AI_USAGE.md              # AI tool usage documentation
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Django backend |
| Node.js | 18+ | Vite frontend build |
| PostgreSQL | 14+ | Database (or use remote DB via `DATABASE_URL`) |

### 1. Clone the Repository

```bash
git clone https://github.com/pavandoddavarapu/splitwise.git
cd splitwise
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
cd backend
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, SECRET_KEY, etc.

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on :5173
# API calls proxy to Django on :8000
```

### 4. Production Build (Optional)

```bash
# Build React → static assets → Django serves everything
cd frontend && npm run build
cd ../backend && python manage.py collectstatic --noinput
python manage.py runserver
# Visit http://localhost:8000 — full production-like setup
```

---

## 🔐 Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | — | Django cryptographic signing key |
| `DEBUG` | ❌ | `False` | `True` for development, `False` for production |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (e.g., `postgres://user:pass@host:5432/db`) |
| `ALLOWED_HOSTS` | ❌ | `*` | Comma-separated list of allowed hostnames |

---

## ☁️ Deployment

### Render (Current Setup)

The app deploys as a **single Render web service** using [`render.yaml`](render.yaml):

```yaml
# Build pipeline (runs on every git push to main):
1. pip install -r backend/requirements.txt    # Python deps
2. cd frontend && npm install && npm run build # React → dist/
3. python manage.py collectstatic --noinput    # dist/ → staticfiles/
4. python manage.py migrate                    # Apply DB migrations

# Start command:
gunicorn spreetail.wsgi:application --bind 0.0.0.0:$PORT
```

The Render blueprint also provisions a **managed PostgreSQL instance** and auto-wires `DATABASE_URL`.

### Manual Deployment

Any platform that supports Python + PostgreSQL will work:

1. Set the environment variables listed above
2. Run the build pipeline (steps 1–4)
3. Start Gunicorn (or any WSGI server)
4. Point your reverse proxy to Gunicorn's port

---

## 🧠 Design Decisions

Key architectural choices are documented in [`DECISIONS.md`](DECISIONS.md). Highlights:

| Decision | Summary |
|----------|---------|
| **D-001** | Django + DRF instead of Next.js — Python is stronger for the CSV/anomaly pipeline |
| **D-002** | Fixed FX rate ₹83.50/USD — documented, reproducible, auditable |
| **D-003** | `AbstractUser` — Django auth machinery with custom fields, set before first migration |
| **D-004** | Monorepo — single `render.yaml` deploys everything, no coordination |
| **D-005** | Kabir excluded — one-day guest logged as anomaly, not a user |
| **D-006** | No stored balances — live `SUM()` queries over `expense_shares` for auditability |
| **D-007** | Token in `localStorage` — accepted XSS tradeoff for simplicity (httpOnly cookies in production) |
| **D-008** | Largest Remainder Method — deterministic rounding residue allocation for paisa-perfect totals |

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| [`README.md`](README.md) | This file — architecture, setup, API reference |
| [`DECISIONS.md`](DECISIONS.md) | Architectural decision log with rationale |
| [`SCOPE.md`](SCOPE.md) | Database schema and anomaly catalogue |
| [`PROGRESS.md`](PROGRESS.md) | Step-by-step build log |
| [`AI_USAGE.md`](AI_USAGE.md) | AI tool usage and documented mistakes |
| [`render.yaml`](render.yaml) | Render deployment blueprint |
| [`expenses_export.csv`](expenses_export.csv) | The messy real-world CSV test data |

---

<div align="center">

**Built with 💜 by [Pavan Doddavarapu](https://github.com/pavandoddavarapu)**

*Expense tracking that handles the real world — messy data and all.*

</div>
]]>
