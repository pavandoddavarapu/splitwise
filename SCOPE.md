# SCOPE.md

Tracks the anomaly handling catalogue and the full DB schema.
Updated incrementally as steps 7–9 complete.

---

## Database schema

Implemented as Django ORM models. See each app's `models.py` for field-level detail.

| Table | Django model | App |
|-------|-------------|-----|
| `users` | `accounts.User` (AbstractUser) | accounts |
| `groups` | `groups.Group` | groups |
| `group_memberships` | `groups.GroupMembership` | groups |
| `expenses` | `expenses.Expense` | expenses |
| `expense_shares` | `expenses.ExpenseShare` | expenses |
| `settlements` | `expenses.Settlement` | expenses |
| `import_batches` | `imports.ImportBatch` | imports |
| `import_anomalies` | `imports.ImportAnomaly` | imports |

Schema notes:
- No stored balance columns anywhere — all computed via ORM aggregation over `expense_shares`
- `expenses.fx_rate_to_inr` is nullable; only set when `original_currency != 'INR'`
- `import_anomalies.raw_row` is a JSONField — stores the entire CSV row as-is for auditability

---

## Anomaly catalogue

To be filled in during Steps 7–9 as each detection rule is implemented and tested
against `expenses_export.csv`.

| # | Category | Detection rule | Policy | Status |
|---|----------|---------------|--------|--------|
| 1 | Mixed date formats | Date non-ISO parsed & normalized | Normalize to ISO | ✅ |
| 2 | Ambiguous date | DD/MM vs MM/DD ambiguity flagged | Default DD/MM, flag | ✅ |
| 3 | Exact duplicate rows | Same signature + details duplicate | Import first, skip second, log both | ✅ |
| 4 | Conflicting duplicate rows | Same signature, diff details/description | Import both as `disputed` | ✅ |
| 5 | Settlement logged as expense | Settle/repay keyword or 1-to-1 split | Create `settlements` row | ✅ |
| 6 | USD amounts | Currency == USD | Convert at ₹83.50/USD, store rate | ✅ |
| 7 | Missing currency | Currency blank | Default INR, flag | ✅ |
| 8 | Amount formatting | Trailing spaces, commas, symbols | Strip/parse/round to 2dp, flag if changed | ✅ |
| 9 | Negative amount | Amount < 0 | Treat as refund, flag | ✅ |
| 10 | Zero amount | Amount == 0 | `voided` status, flag | ✅ |
| 11 | Inconsistent member names | Clean whitespace / resolve aliases | Alias map, normalize, flag each | ✅ |
| 12 | Missing payer | Blank or unresolvable payer | `needs_review`, no expense created | ✅ |
| 13 | % split ≠ 100% | Split percentage sum != 100 | Rescale proportionally, flag | ✅ |
| 14 | split_type/details mismatch | Details spec differs from split type | Consistent→ignore details; else use details, flag | ✅ |
| 15 | Non-member in split_with | User not in group membership | Exclude, recompute, flag | ✅ |
| 16 | Member outside membership window | User active outside window on date | Exclude, recompute, flag | ✅ |
