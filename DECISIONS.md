<![CDATA[# DECISIONS.md

Decision log for the Spreetail Shared Expenses app.
Each entry documents a significant architectural or design decision: what was decided, what alternatives were considered, and why the chosen option won.

---

## D-001 — Tech stack: Django + React instead of Next.js + Prisma

**Date**: 2026-06-14  
**Step**: 1 (scaffold)

**Decision**: Replace the tech stack stated in the original brief (Next.js + Prisma + Vercel) with Django + DRF + React/Vite + Render.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Next.js + Prisma + Vercel** (original brief) | TypeScript end-to-end; Vercel's edge runtime is fast; Prisma has nice DX | Python is far stronger for CSV parsing/data pipelines; Vercel + separate DB adds deploy complexity; Prisma migrations are less mature than Django's |
| **Django + DRF + React/Vite + Render** (chosen) | Python excels at CSV parsing and data transformation; Django ORM has battle-tested migrations; single-process deploy on Render (no CORS); DRF provides robust serialization | Two languages (Python + JS); Vite build step adds a deploy step |
| **Flask + React** | Lighter than Django | No built-in ORM, migrations, admin, auth — would have to bolt on SQLAlchemy, Alembic, Flask-Login, etc. |

**Why chosen**: The CSV import pipeline (570+ lines of rules engine) is the core of the app. Python's `csv`, `re`, `decimal`, and `datetime` libraries are superior to JavaScript's equivalents for this workload. Django's built-in auth, ORM, and migration system saved significant development time. The single-origin deploy on Render (Django serves React's static files via WhiteNoise) eliminated all CORS issues.

---

## D-002 — USD → INR exchange rate: fixed vs. live API

**Date**: 2026-06-14  
**Step**: 1 (scaffold, referenced in schema)

**Decision**: Use a fixed rate of **1 USD = ₹83.50** for all currency conversions.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Live FX API at import time** (e.g., openexchangerates.org) | Accurate real-time rate | External dependency; rate changes between runs make results non-reproducible; free tier rate limits |
| **Historical rate lookup** | Accurate for each transaction date | Requires paid API subscription; complex date-based caching |
| **Fixed documented rate** (chosen) | Reproducible; evaluators can verify math independently; no external dependency | Slightly inaccurate vs. actual rate on each day |

**Why chosen**: The trip was in March 2026. ₹83.50 is representative of the RBI reference rate for that period. For this project's scope, reproducibility and auditability outweigh precision. The original amount and currency are always preserved (`original_amount`, `original_currency`), and the rate used is stored in `fx_rate_to_inr`, so the conversion is fully auditable.

---

## D-003 — User model: AbstractUser vs. built-in User vs. custom from scratch

**Date**: 2026-06-14  
**Step**: 1 (scaffold)

**Decision**: Extend `django.contrib.auth.models.AbstractUser` rather than using Django's built-in `User` directly or building a custom user model from scratch.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Built-in `User`** | Zero setup | Cannot add custom fields without a separate `Profile` table; cannot change email to be the primary login |
| **`AbstractUser`** (chosen) | Full auth machinery (password hashing, admin, validators) + custom fields | Must be set as `AUTH_USER_MODEL` before any migration; cannot change later |
| **`AbstractBaseUser`** | Maximum control over every field | Significantly more code required; must implement `is_active`, permissions, etc. from scratch |

**Why chosen**: `AbstractUser` is the "goldilocks" option — it gives us Django's entire auth stack (PBKDF2-SHA256 hashing, session framework, admin integration, password validators) while letting us add `name` and `created_at` fields and enforce `email` uniqueness at the DB level. Setting `AUTH_USER_MODEL = 'accounts.User'` from migration 0001 locks this in cleanly.

---

## D-004 — Repository structure: monorepo vs. separate repos

**Date**: 2026-06-14  
**Step**: 1 (scaffold)

**Decision**: `/backend` (Django project) and `/frontend` (Vite app) live in the same Git repository.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Monorepo** (chosen) | Single `render.yaml` deploys everything; atomic commits across frontend + backend; simpler CI | Larger repo; frontend devs see backend code and vice versa |
| **Two separate repos** | Clear ownership boundaries | Coordinating deploys between repos is complex; Render needs access to both; API contract drift risk |

**Why chosen**: Render's single web service build command needs access to both directories. The build pipeline is: `npm run build` (frontend) → `collectstatic` (copy dist/ into Django's staticfiles) → `migrate` (apply DB changes). This only works cleanly in a single repo. The small team size (1 developer) makes the overhead of two repos unjustifiable.

---

## D-005 — Kabir: create user vs. exclude as anomaly

**Date**: 2026-06-14  
**Step**: 1 (scaffold — pre-confirmed before seeding)

**Decision**: Kabir (mentioned once in the CSV as "Dev's friend Kabir", a single-day guest on the Goa trip) does NOT get a `User` row or a `GroupMembership` row. His presence is logged as an `ImportAnomaly` with `anomaly_type = 'excluded_participant'`.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Create a user + short membership** | Accurate split math including Kabir | Pollutes user list with a ghost user who has no login; balance calculation shows a person who owes/is-owed money but can never settle |
| **Exclude and log as anomaly** (chosen) | Clean user list; no orphaned balances; brief explicitly requires this | Parasailing expense split is divided among 4 people instead of 5 (each person's share is higher) |

**Why chosen**: The brief (Section 5) explicitly states that one-day guests should be excluded. Creating a user for someone who will never log in or settle debts creates a permanent imbalance in the system. The anomaly log preserves the fact that Kabir was present, satisfying the auditability requirement.

---

## D-006 — Balance calculation: live computation vs. stored totals

**Date**: 2026-06-14  
**Step**: 1 (scaffold — architectural constraint)

**Decision**: User balances are NEVER stored as a column or cached value. Every balance is computed on demand via:

```
net = SUM(expense.amount_inr WHERE paid_by = user)
    - SUM(expense_share.share_amount_inr WHERE user_id = user)
    + SUM(settlements.amount_inr WHERE paid_to = user)
    - SUM(settlements.amount_inr WHERE paid_by = user)
```

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Stored balance column** (updated on every transaction) | O(1) read performance | Can drift from actual rows due to bugs, manual DB edits, or failed transactions; not auditable |
| **Materialized view / cache** | Fast reads; eventually consistent | Stale data window; complexity of cache invalidation |
| **Live `SUM()` aggregation** (chosen) | Always correct by definition; every number is traceable to rows; zero cache invalidation logic | Slightly slower reads (but Django ORM `annotate(Sum(...))` is efficient for this data volume) |

**Why chosen**: This is Rohan's core requirement — every displayed balance must be directly traceable to underlying `expense_shares` and `settlements` rows. If a balance is cached, the question "why does this number say ₹2,450?" becomes unanswerable without diffing the cache against the rows. With live computation, the drill-down simply shows the rows that produced the number.

---

## D-007 — Auth token storage: localStorage vs. httpOnly cookies

**Date**: 2026-06-15  
**Step**: 2 (auth)

**Decision**: Auth token stored in `localStorage`; known XSS tradeoff accepted for this scope.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **`localStorage`** (chosen) | Simple implementation; easy to attach to `Authorization` header; works with single-origin deploy; survives page refreshes | Vulnerable to XSS (malicious scripts can read `localStorage`) |
| **`httpOnly` + `Secure` + `SameSite=Strict` cookie** | Immune to XSS (JavaScript cannot access httpOnly cookies) | Requires CSRF protection; more complex server setup; cookie-based auth doesn't play well with DRF's default `TokenAuthentication` header |
| **In-memory only (React state)** | Most secure (no persistence) | Token lost on page refresh; terrible UX |

**Why chosen**: The single-origin deployment model means there's no cross-site cookie complexity. `localStorage` + `Authorization: Token xxx` header is the standard DRF pattern. In a production environment, switching to httpOnly cookies with CSRF tokens would be the right move, but for this project's scope the simplicity tradeoff is justified.

---

## D-008 — Rounding residue: Largest Remainder Method vs. alternatives

**Date**: 2026-06-15  
**Step**: 4 (manual expense creation)

**Decision**: Resolve mathematical rounding residue using the **Largest Remainder Method** (Hare-Niemeyer), sorted by descending fractional remainder with ascending user ID as a deterministic tiebreaker.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Truncate and ignore residue** | Simple | `SUM(shares) ≠ expense total` — breaks auditability |
| **Always give extra to first user** | Deterministic | Unfair — same person always pays the extra paisa |
| **Largest Remainder Method** (chosen) | Fair allocation; deterministic; widely used in parliamentary seat allocation | Slightly more complex to implement |
| **Round-robin across expenses** | Distributes residue over time | Non-deterministic per expense; harder to audit |

**Why chosen**: When splitting ₹835.00 equally among 3 people, naive rounding gives ₹278.33 × 3 = ₹834.99 (₹0.01 missing). The Largest Remainder Method allocates the residual paisa to the member(s) with the largest fractional remainder. Using user ID as a tiebreaker ensures the result is identical every time for the same inputs. This guarantees `SUM(share_amount_inr) == expense.amount_inr` for every single expense — the foundation of auditability.

**Example**:
```
₹835.00 ÷ 3 = 278.333...
Floor: 278.33 × 3 = 834.99, residue = 0.01
Remainders: [0.003..., 0.003..., 0.003...]  (all tied)
Tiebreaker: user with lowest ID gets the extra paisa
Result: [278.34, 278.33, 278.33] — sums to exactly 835.00 ✓
```

---

## D-009 — Settlement simplification: greedy algorithm vs. optimal

**Date**: 2026-06-15  
**Step**: 5 (balance calculation)

**Decision**: Use a **greedy clearing algorithm** to suggest the minimum set of settlement payments, rather than computing the mathematically optimal minimum set.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Greedy algorithm** (chosen) | Simple to implement; O(n log n) time; produces at most N−1 payments; good enough for small groups | Not always mathematically optimal for >3 people (may produce one extra payment in edge cases) |
| **Optimal (NP-hard subset-sum reduction)** | Provably minimum number of transactions | Exponential time complexity; overkill for groups of 4-6 people |
| **No simplification (show all pairwise debts)** | Simplest implementation | Users see N² confusing pairwise balances instead of a clean list |

**Why chosen**: For a group of 4–6 flatmates, the greedy algorithm always produces the optimal or near-optimal result. The algorithm pairs the largest debtor with the largest creditor, transfers the minimum of (|debt|, credit), and repeats until all balances clear. This is O(n log n) and reduces potentially 15 pairwise debts to at most 5 simple payments.

---

## D-010 — CSV header matching: dynamic mapping vs. rigid column order

**Date**: 2026-06-15  
**Step**: 7 (CSV import)

**Decision**: Use **dynamic keyword-based header matching** rather than requiring fixed column positions or exact header names.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Fixed column order** (columns 0-8 hardcoded) | Simplest to implement | Breaks if user reorders columns or adds/removes one |
| **Exact header name match** | Clear contract | Breaks on "Amount" vs "amount" vs "Total" vs "Cost" |
| **Keyword-based fuzzy match** (chosen) | Handles variations like "paid_by", "who paid", "payer"; case-insensitive; resilient to extra columns | More complex; could mis-match unusual headers |

**Why chosen**: Real-world CSV exports vary wildly. The keyword approach (`"pay" in header` matches `paid_by`, `payer`, `who_paid`) makes the importer robust to common variations without requiring the user to rename columns. Headers are normalized (lowercase, underscores) before matching.

---

## D-011 — Import atomicity: all-or-nothing vs. partial import

**Date**: 2026-06-15  
**Step**: 7 (CSV import)

**Decision**: Wrap the entire CSV import in a **single database transaction** (`@transaction.atomic`). If any unrecoverable error occurs, the entire import is rolled back.

**Options considered**:
| Option | Pros | Cons |
|--------|------|------|
| **Atomic (all-or-nothing)** (chosen) | No partial state; clean retry; anomaly counts are always consistent | A single bad row could roll back 42 good rows |
| **Per-row transactions** | Bad rows don't affect good rows | Partial imports leave the database in an inconsistent state; anomaly batch counts can drift |
| **Two-phase (stage then commit)** | User reviews before committing | Much more complex; requires a staging table and a separate approval step |

**Why chosen**: The anomaly detection system handles bad rows gracefully (skipping duplicates, flagging missing payers, converting currencies) — there's no reason a well-handled anomaly should roll back the batch. The `@transaction.atomic` decorator protects against *unexpected* failures (e.g., a database constraint violation from a bug), ensuring the database is never left in a half-imported state.
]]>
