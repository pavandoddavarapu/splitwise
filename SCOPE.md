# SCOPE.md

Anomaly log and database schema for the Spreetail Shared Expenses application.
Every data problem found in `expenses_export.csv` is catalogued below with the specific CSV rows affected, what was detected, and exactly how the system handled it.

---

## Database Schema

### Table overview

| Table | Django Model | App | Purpose |
|-------|-------------|-----|---------|
| `users` | `accounts.User` (AbstractUser) | accounts | User identity, email-based login, display name |
| `expense_groups` | `groups.Group` | groups | Expense-sharing group container |
| `group_memberships` | `groups.GroupMembership` | groups | User ↔ Group junction with join/leave dates |
| `expenses` | `expenses.Expense` | expenses | Payments made by one person on behalf of the group |
| `expense_shares` | `expenses.ExpenseShare` | expenses | Per-user share of each expense (source of truth for balances) |
| `settlements` | `expenses.Settlement` | expenses | Direct payments between users to clear debts |
| `import_batches` | `imports.ImportBatch` | imports | Metadata for each CSV upload |
| `import_anomalies` | `imports.ImportAnomaly` | imports | Every detected issue during import, with raw data preserved |

### Detailed column schema

#### `users`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK, auto-increment | |
| `name` | varchar(255) | | Display name (e.g. "Aisha") |
| `email` | varchar(254) | UNIQUE, NOT NULL | Login identifier |
| `password` | varchar(128) | NOT NULL | PBKDF2-SHA256 hashed by Django |
| `username` | varchar(150) | UNIQUE | Set to email internally |
| `created_at` | datetime | auto_now_add | |

#### `expense_groups`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `name` | varchar(255) | NOT NULL | e.g. "Chennai Flatmates" |
| `created_at` | datetime | auto_now_add | |

#### `group_memberships`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `group_id` | integer | FK → `expense_groups` | CASCADE on delete |
| `user_id` | integer | FK → `users` | CASCADE on delete |
| `joined_at` | date | NOT NULL | When the member joined |
| `left_at` | date | NULLABLE | NULL = still active |

**Unique constraint**: `(group, user, joined_at)` — one interval per user per group.

**Business logic**: `covers_date(date)` method returns True iff `joined_at ≤ date ≤ left_at` (or left_at is NULL). This gates every split calculation.

#### `expenses`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `group_id` | integer | FK → `expense_groups` | |
| `paid_by_id` | integer | FK → `users` | PROTECT on delete |
| `description` | text | NOT NULL | |
| `expense_date` | date | NOT NULL | |
| `original_amount` | decimal(12,2) | NOT NULL | Amount in original currency |
| `original_currency` | varchar(3) | default `'INR'` | `'INR'` or `'USD'` |
| `fx_rate_to_inr` | decimal(10,4) | NULLABLE | Set only for USD rows (83.50) |
| `amount_inr` | decimal(12,2) | NOT NULL | Canonical amount for all balance math |
| `split_type` | varchar(20) | NOT NULL | `equal` / `percentage` / `exact` / `share` |
| `status` | varchar(20) | default `'active'` | `active` / `disputed` / `voided` |
| `source` | varchar(20) | default `'manual'` | `manual` / `import` |
| `notes` | text | blank allowed | |
| `created_at` | datetime | auto_now_add | |

#### `expense_shares`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `expense_id` | integer | FK → `expenses` | CASCADE on delete |
| `user_id` | integer | FK → `users` | PROTECT on delete |
| `share_amount_inr` | decimal(12,2) | NOT NULL | This user's share in INR |
| `share_raw` | varchar(200) | | Human-readable split trace (e.g. "33.33%", "2 shares of 6") |

**Unique constraint**: `(expense, user)` — one share per user per expense.

**Design note**: This is the **source of truth** for balances. No balance column exists anywhere in the schema. Every displayed balance is `SUM(paid) − SUM(owed) ± settlements`.

#### `settlements`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `group_id` | integer | FK → `expense_groups` | |
| `paid_by_id` | integer | FK → `users` | Person paying |
| `paid_to_id` | integer | FK → `users` | Person receiving |
| `amount_inr` | decimal(12,2) | NOT NULL | |
| `settled_at` | datetime | NOT NULL | |
| `source` | varchar(20) | default `'manual'` | `manual` / `import` |
| `notes` | text | blank allowed | |

#### `import_batches`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `filename` | varchar(255) | | Original CSV filename |
| `imported_at` | datetime | auto_now_add | |
| `imported_by_id` | integer | FK → `users` (nullable) | Who ran the import |
| `row_count` | integer | default 0 | Total data rows processed |
| `anomaly_count` | integer | default 0 | Number of anomalies detected |

#### `import_anomalies`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | integer | PK | |
| `batch_id` | integer | FK → `import_batches` | CASCADE |
| `source_row_number` | integer | | CSV row number (1-indexed from data rows) |
| `raw_row` | JSON | NOT NULL | Entire original CSV row preserved verbatim |
| `anomaly_type` | varchar(50) | | One of 17 coded types (see catalogue below) |
| `description` | text | | Human-readable explanation of what was detected |
| `applied_policy` | text | | What the system did about it |
| `status` | varchar(20) | default `'auto_handled'` | `auto_handled` / `needs_review` / `resolved` |
| `linked_expense_id` | integer | FK → `expenses` (nullable) | Expense created from this row, if any |
| `linked_settlement_id` | integer | FK → `settlements` (nullable) | Settlement created from this row, if any |

### Schema design principles

- **No stored balances**: Every balance is computed live via `SUM()` over `expense_shares` and `settlements`. No cache, no drift, no trust issues.
- **Full auditability**: Original amounts and currencies preserved. FX rate recorded. `share_raw` explains the math. `raw_row` stores the original CSV row as JSON.
- **Timeline awareness**: `GroupMembership.covers_date()` gates every split. Meera's expenses after she left are excluded; Sam's expenses before he joined are excluded.
- **Referential integrity**: `paid_by` uses `PROTECT` on delete — you cannot delete a user who has expenses, preventing orphaned financial records.

---

## Anomaly Catalogue

Every anomaly detected during CSV import of `expenses_export.csv`. For each anomaly type, the table shows: the detection rule, what specific CSV rows triggered it, the exact data problem found, and what policy was applied.

### 1 — Mixed date formats

| Field | Detail |
|-------|--------|
| **Detection rule** | Date string is not ISO format (`YYYY-MM-DD`) but can be parsed with alternative format |
| **CSV rows affected** | Row 16 (`01/03/2026`), Row 17 (`03/03/2026`), Row 18 (`05/03/2026`), Row 19 (`08/03/2026`), Row 20 (`09/03/2026`), Row 21 (`10/03/2026`), Row 22 (`10/03/2026`), Row 23 (`11/03/2026`), Row 24 (`11/03/2026`), Row 25 (`11/03/2026`), Row 26 (`12/03/2026`), Row 27 (`Mar 14`), Row 28 (`15/03/2026`), Row 29 (`18/03/2026`), Row 30 (`20/03/2026`), Row 31 (`22/03/2026`), Row 32 (`25/03/2026`), Row 33 (`28/03/2026`), Row 34 (`04/05/2026`) |
| **Policy** | Normalize to ISO `YYYY-MM-DD`. Indian locale assumed: `DD/MM/YYYY` is the default interpretation. Freeform dates like `Mar 14` parsed via strptime fallback. Each converted row logged as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 2 — Ambiguous date (DD/MM vs MM/DD)

| Field | Detail |
|-------|--------|
| **Detection rule** | Both day and month values are ≤ 12 and different, so `DD/MM` vs `MM/DD` is genuinely ambiguous |
| **CSV rows affected** | Row 34 (`04/05/2026` — is this April 5 or May 4? The note says: "is this April 5 or May 4? format is a mess") |
| **Policy** | Default to DD/MM (Indian locale) → parsed as **4 May 2026**. Flagged as `needs_review` so a human can override if it was actually April 5. |
| **Status** | ✅ Implemented and tested |

### 3 — Exact duplicate rows

| Field | Detail |
|-------|--------|
| **Detection rule** | Two rows with identical (date, payer, amount) signature AND matching description/details |
| **CSV rows affected** | Row 5 (`Dinner at Marina Bites, Dev, ₹3200`) and Row 6 (`dinner - marina bites, Dev, ₹3200`) — same date, same payer, same amount; descriptions differ only in casing and punctuation |
| **Policy** | Import the first occurrence (Row 5) as a normal expense. Skip the second occurrence (Row 6) and log it as `exact_duplicate` with `auto_handled` status. Both rows preserved in `raw_row` JSON. |
| **Status** | ✅ Implemented and tested |

### 4 — Conflicting duplicate rows

| Field | Detail |
|-------|--------|
| **Detection rule** | Two rows with matching (date, approximate description) but different amounts or payers |
| **CSV rows affected** | Row 24 (`Dinner at Thalassa, Aisha, ₹2400`) and Row 25 (`Thalassa dinner, Rohan, ₹2450`) — same restaurant, same date, different payers and amounts. Note says: "Aisha also logged this I think hers is wrong" |
| **Policy** | Import **both** rows with `status = 'disputed'`. Both flagged as `conflicting_duplicate` anomalies with `needs_review` status so a human can decide which is correct (or delete one). |
| **Status** | ✅ Implemented and tested |

### 5 — Settlement logged as expense

| Field | Detail |
|-------|--------|
| **Detection rule** | Keywords like "paid back", "settle", "repay" in description, or a 1-to-1 split pattern |
| **CSV rows affected** | Row 14 (`Rohan paid Aisha back, ₹5000`) — note says "this is a settlement not an expense??" |
| **Policy** | Do NOT create an `Expense` row. Instead create a `Settlement` row: `paid_by = Rohan`, `paid_to = Aisha`, `amount_inr = 5000`, `source = 'import'`. Logged as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 6 — USD amounts

| Field | Detail |
|-------|--------|
| **Detection rule** | `currency` column contains `USD` |
| **CSV rows affected** | Row 20 (`Goa villa booking, $540`), Row 21 (`Beach shack lunch, $84`), Row 23 (`Parasailing, $150`), Row 26 (`Parasailing refund, -$30`) |
| **Policy** | Convert to INR using fixed rate **₹83.50/USD** (see DECISIONS.md D-002). Store `original_amount`, `original_currency = 'USD'`, `fx_rate_to_inr = 83.50`, and `amount_inr = original × 83.50`. E.g., $540 → ₹45,090.00. Each conversion logged as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 7 — Missing currency

| Field | Detail |
|-------|--------|
| **Detection rule** | Currency column is blank/empty |
| **CSV rows affected** | Row 28 (`Groceries DMart, Priya, 2105`) — note says "forgot to set currency" |
| **Policy** | Default to INR. Flag as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 8 — Amount formatting issues

| Field | Detail |
|-------|--------|
| **Detection rule** | Amount contains commas, leading/trailing spaces, currency symbols, or excessive decimal places |
| **CSV rows affected** | Row 7 (`"1,200"` — comma-formatted), Row 10 (`899.995` — 3 decimal places), Row 29 (` 1450 ` — leading and trailing spaces) |
| **Policy** | Strip whitespace, remove commas and currency symbols, parse as Decimal, round to 2 decimal places. `"1,200"` → `1200.00`, `899.995` → `900.00`, ` 1450 ` → `1450.00`. Each flagged as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 9 — Negative amount (refund)

| Field | Detail |
|-------|--------|
| **Detection rule** | Parsed amount is less than zero |
| **CSV rows affected** | Row 26 (`Parasailing refund, Dev, -$30, USD`) — note says "one slot got cancelled" |
| **Policy** | Treat as a valid refund. Import as an expense with `amount_inr = -2505.00` (after USD conversion: -30 × 83.50). Flag as anomaly with `auto_handled` status. Balances naturally adjust since negative shares reduce what members owe. |
| **Status** | ✅ Implemented and tested |

### 10 — Zero amount

| Field | Detail |
|-------|--------|
| **Detection rule** | Parsed amount equals zero |
| **CSV rows affected** | Row 31 (`Dinner order Swiggy, Priya, ₹0`) — note says "counted twice earlier - fixing later" |
| **Policy** | Create expense with `status = 'voided'`. Shares are ₹0 each, so no balance impact. Flag as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 11 — Inconsistent member names

| Field | Detail |
|-------|--------|
| **Detection rule** | Name differs from canonical form after alias map and whitespace normalization |
| **CSV rows affected** | Row 9 (`priya` — lowercase), Row 11 (`Priya S` — has suffix), Row 27 (`rohan ` — trailing space) |
| **Policy** | Normalize via alias map: `"priya"` → `"Priya"`, `"Priya S"` → `"Priya"`, `"rohan "` → `"Rohan"`. Each normalization logged as anomaly with `auto_handled` status. Original name preserved in `raw_row` JSON. |
| **Status** | ✅ Implemented and tested |

### 12 — Missing payer

| Field | Detail |
|-------|--------|
| **Detection rule** | Payer column is blank, or the payer name cannot be resolved to any registered user |
| **CSV rows affected** | Row 13 (`House cleaning supplies, [blank], ₹780`) — note says "can't remember who paid" |
| **Policy** | Do NOT create an expense (no `paid_by` → impossible to allocate). Create anomaly with `status = 'needs_review'`. The UI displays this row with a dropdown letting the user select who paid, then approve/resolve it. |
| **Status** | ✅ Implemented and tested |

### 13 — Percentages don't sum to 100%

| Field | Detail |
|-------|--------|
| **Detection rule** | Split type is `percentage` and the values sum to something other than 100% |
| **CSV rows affected** | Row 15 (`Pizza Friday, percentage split: Aisha 30%, Rohan 30%, Priya 30%, Meera 20%`) — sums to 110%, not 100%. Note says "percentages might be off" |
| **Policy** | Rescale proportionally: each percentage divided by the actual sum (110) and multiplied by 100. So 30/110 = 27.27%, 20/110 = 18.18%. Shares computed from rescaled percentages. Flagged as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 14 — split_type/details mismatch

| Field | Detail |
|-------|--------|
| **Detection rule** | `split_type` column says one thing, but `split_details` column contains data suggesting another type |
| **CSV rows affected** | Row 42 (`Furniture for common room, split_type = 'equal'`, but `split_details = "Aisha 1; Rohan 1; Priya 1; Sam 1"`) — note says "split_type says equal but someone added shares anyway" |
| **Policy** | If the details are consistent with the type (here: all shares equal → effectively equal split), use the simple type and ignore the redundant details. If they conflict, use the details column as the authoritative source. Flag as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 15 — Non-member in split_with

| Field | Detail |
|-------|--------|
| **Detection rule** | A name in `split_with` is not a registered user or not a member of the target group |
| **CSV rows affected** | Row 38 (`Sam deposit share, Sam, ₹15000, split_with: Aisha`) — Sam may not be a registered member at import time |
| **Policy** | Exclude unresolvable names from the split. Recompute shares among remaining valid members using the Largest Remainder Method. Flag excluded name as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 16 — Member outside membership window

| Field | Detail |
|-------|--------|
| **Detection rule** | A user in `split_with` has a `GroupMembership` that does not cover the expense date (joined after or left before) |
| **CSV rows affected** | Row 36 (`Groceries BigBasket, 2026-04-02, split_with includes Meera`) — but Meera's `left_at` is `2026-03-31`, so she was not an active member on April 2. Note says "oops Meera still in the group list" |
| **Policy** | Exclude Meera from the split for this expense. Recompute shares among remaining active members (Aisha, Rohan, Priya). Flag as anomaly with `auto_handled` status. |
| **Status** | ✅ Implemented and tested |

### 17 — Excluded participant (not a registered user)

| Field | Detail |
|-------|--------|
| **Detection rule** | A name in `split_with` is not and should not be a registered user (guest/one-time visitor) |
| **CSV rows affected** | Row 23 (`Parasailing, $150, split_with includes "Dev's friend Kabir"`) — Kabir joined for one day only during the Goa trip |
| **Policy** | Do NOT create a `User` row or `GroupMembership` for Kabir. Exclude him from the split entirely. Recompute shares among the 4 registered members (Aisha, Rohan, Priya, Dev). Flag as anomaly with `auto_handled` status describing why Kabir was excluded. See DECISIONS.md D-005 for rationale. |
| **Status** | ✅ Implemented and tested |

---

## Summary of CSV rows with anomalies

| CSV Row | Description | Anomalies Triggered |
|---------|-------------|---------------------|
| 5 | Dinner at Marina Bites | #3 (first of duplicate pair) |
| 6 | dinner - marina bites | #3 (exact duplicate — skipped) |
| 7 | Electricity Feb | #8 (comma in amount: "1,200") |
| 9 | Movie night snacks | #11 (payer: "priya" → "Priya") |
| 10 | Cylinder refill | #8 (3 decimal places: 899.995 → 900.00) |
| 11 | Groceries DMart | #11 (payer: "Priya S" → "Priya") |
| 13 | House cleaning supplies | #12 (missing payer → needs_review) |
| 14 | Rohan paid Aisha back | #5 (settlement re-routed) |
| 15 | Pizza Friday | #13 (percentages sum to 110%) |
| 16–26 | March expenses | #1 (DD/MM/YYYY format normalized) |
| 20 | Goa villa booking | #6 (USD $540 → ₹45,090.00) |
| 21 | Beach shack lunch | #6 (USD $84 → ₹7,014.00) |
| 23 | Parasailing | #6 (USD $150 → ₹12,525.00), #17 (Kabir excluded) |
| 24 | Dinner at Thalassa | #4 (conflicting duplicate — disputed) |
| 25 | Thalassa dinner | #4 (conflicting duplicate — disputed) |
| 26 | Parasailing refund | #6 (USD), #9 (negative amount: refund) |
| 27 | Airport cab | #1 ("Mar 14" parsed), #11 ("rohan " → "Rohan") |
| 28 | Groceries DMart | #7 (missing currency → INR) |
| 29 | Electricity Mar | #8 (whitespace: " 1450 " → 1450.00) |
| 31 | Dinner order Swiggy | #10 (zero amount → voided) |
| 32 | Weekend brunch | #13 (percentages sum to 110%) |
| 34 | Deep cleaning service | #2 (ambiguous date: 04/05 → needs_review) |
| 36 | Groceries BigBasket | #16 (Meera outside membership window) |
| 42 | Furniture for common room | #14 (split_type/details mismatch) |
