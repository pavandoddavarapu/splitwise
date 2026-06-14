# DECISIONS.md

Decision log for the Spreetail Shared Expenses app.
Updated continuously — one entry per non-obvious choice, with rationale.

---

## D-001 — Tech stack change (original brief vs. actual)

**Date**: 2026-06-14
**Step**: 1 (scaffold)

**Decision**: Replace the tech stack stated in the original brief (Next.js + Prisma + Vercel)
with Django + DRF + React/Vite + Render.

**Original brief said**:
- Next.js (App Router, TypeScript)
- Prisma ORM
- Deploy: Vercel

**Actual stack**:
- Backend: Django 4.2 + Django REST Framework — all API and business logic
- Frontend: React via Vite — built as static assets, served by Django via whitenoise
- ORM: Django ORM + migrations (not Prisma; relational DB constraint still satisfied)
- Auth: Django built-in password hashing + DRF TokenAuthentication (replaces bcrypt + session cookie)
- Deploy: Single Render web service (Django serves everything — no CORS needed, same origin)

**Rationale**: The engineer of record requested this change before any code was written.
Python is a better fit for the CSV parsing/anomaly pipeline. Single-process deploy on Render
is simpler to reason about than a split Next.js + API deployment.

---

## D-002 — USD → INR FX rate

**Date**: 2026-06-14
**Step**: 1 (scaffold, referenced in schema)

**Decision**: Use a fixed rate of **1 USD = ₹83.50** for all currency conversions.

**Rationale**: The trip was in March 2026. ₹83.50 is representative of the RBI reference rate
for that period. In production we would call a live FX API (e.g., openexchangerates.org)
at import time and store the rate returned. For this project scope, a fixed documented rate
is explicit and reproducible — evaluators can verify conversion math independently.

**Where stored**: `expenses.fx_rate_to_inr` column (nullable; only set when `original_currency != 'INR'`).
The original amount and currency are also preserved (`original_amount`, `original_currency`),
so the rate used is always auditable.

---

## D-003 — AbstractUser for the accounts model

**Date**: 2026-06-14
**Step**: 1 (scaffold)

**Decision**: Extend `django.contrib.auth.models.AbstractUser` rather than using Django's
built-in `User` directly.

**Rationale**: `AbstractUser` gives us Django's full auth machinery (password hashing,
session framework, admin integration) while letting us add fields (`name`, timestamps)
and change auth behaviour (e.g., use email as primary identifier) without a separate
`Profile` table. Setting `AUTH_USER_MODEL = 'accounts.User'` in settings locks this in
from migration 0001 — changing it later would require resetting all migrations.

**Note on password hashing**: Django uses PBKDF2-SHA256 by default (bcrypt available as
an option via `PASSWORD_HASHERS`). DRF TokenAuthentication is the auth transport — no
separate JWT library needed for this scope.

---

## D-004 — Single-repo layout

**Date**: 2026-06-14
**Step**: 1 (scaffold)

**Decision**: `/backend` (Django project) and `/frontend` (Vite app) live in the same
Git repository.

**Rationale**: Render's single web service build command needs access to both. A monorepo
avoids deploy coordination complexity. `frontend/dist/` is built during the Render build
step and collected by Django's `collectstatic` into `backend/staticfiles/`, then served
by whitenoise.

---

## D-005 — Kabir handled as import anomaly, not a user

**Date**: 2026-06-14
**Step**: 1 (scaffold — pre-confirmed before seeding)

**Decision**: Kabir (mentioned once in the CSV as a single-day guest) does NOT get a
`User` row or a `GroupMembership` row. His presence is logged as an `ImportAnomaly`
with `anomaly_type = 'excluded_participant'`.

**Rationale**: Brief Section 5 explicitly states this. Creating a user for a one-day
guest would pollute balance calculations with a zero-balance ghost user.

---

## D-006 — Balance calculation: no stored totals

**Date**: 2026-06-14
**Step**: 1 (scaffold — architectural constraint)

**Decision**: User balances are NEVER stored as a column or cached value. Every balance
is computed on demand as:

```
net = SUM(expense.amount_inr WHERE paid_by = user)
    - SUM(expense_share.share_amount_inr WHERE user_id = user)
    ± SUM(settlements paid/received)
```

**Rationale**: Rohan's requirement — every displayed balance must be traceable to
underlying `expense_shares` rows. If we cache a balance, it can drift from the rows
and become untrustworthy. Django ORM `annotate(Sum(...))` makes this efficient without
storing derived data.

---

## D-007 — Auth token storage in client

**Date**: 2026-06-15
**Step**: 2 (auth)

**Decision**: Auth token stored in localStorage for simplicity; known XSS tradeoff — production would use httpOnly cookies.

**Rationale**: Storing the token in `localStorage` allows easy client-side storage, request headers integration, and auth rehydration without setting up cross-site cookies, CORS, or a cookie proxy. However, `localStorage` is susceptible to cross-site scripting (XSS) attacks. In a production environment, securing tokens in an `httpOnly`, `secure`, and `SameSite=Strict` cookie is preferred to mitigate this threat. For the current scope of the application, this trade-off is accepted for simplicity.

---

## D-008 — Rounding Residue Allocation via Largest Remainder Method

**Date**: 2026-06-15
**Step**: 4 (manual expense creation)

**Decision**: Resolve mathematical rounding residue (e.g. splitting ₹835.00 among 3 people equally) using the Largest Remainder Method (Hare-Niemeyer) sorted in descending order of fractional remainders and ascending order of user ID as a deterministic tie-breaker.

**Rationale**: When splitting amounts with fractions (like $10.00 / 3 = $3.33 each with a remaining $0.01) or when converting split values from USD to INR, individual shares when rounded to 2 decimal places can sum to an amount different from the total. If we do not resolve this, the sum of all `ExpenseShare` rows would not equal the expense's `amount_inr`, breaking total auditability. Using the Largest Remainder Method allocates the leftover cents to the users with the highest rounding remainder. If there is a tie, sorting by user ID ensures determinism. This guarantees that the sum of `ExpenseShare` amounts always matches the total expense amount down to the last paisa.


