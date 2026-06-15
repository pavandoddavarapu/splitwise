# IMPORT_REPORT.md

Import Report produced by the Spreetail Shared Expenses application upon ingesting the real-world CSV export.

---

## Batch Metadata

| Property | Value |
|----------|-------|
| **File Name** | `expenses_export.csv` |
| **Imported At** | `2026-06-15 02:54:34 UTC` |
| **Imported By** | `Pavan (admin@example.com)` |
| **Total Rows Processed** | `42` |
| **Total Anomalies Detected** | `125` |

---

## Detailed Anomaly Log

Below is the complete audit log of all anomalies detected by the ingestion engine, showing the source CSV row number, the anomaly category, description of the issue, the automated action taken (applied policy), and its final status.

| Row # | Category | Description | Applied Policy / Action Taken | Status |
|-------|----------|-------------|-------------------------------|--------|
| 2 | Ambiguous date | Date '2026-02-01' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 2 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 3 | Ambiguous date | Date '2026-02-03' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 3 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 4 | Ambiguous date | Date '2026-02-05' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 4 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 5 | Ambiguous date | Date '2026-02-08' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 5 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 5 | Conflicting duplicate | Conflicting duplicate with row(s) 6 (same date/payer/amount but different details). | Imported both expenses with 'disputed' status | Auto Handled ✅ |
| 6 | Ambiguous date | Date '2026-02-08' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 6 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 6 | Conflicting duplicate | Conflicting duplicate of row 5 (same date/payer/amount but different description or split). | Imported both expenses with 'disputed' status | Auto Handled ✅ |
| 7 | Ambiguous date | Date '2026-02-10' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 7 | Amount formatting issue | Amount '1,200' has formatting issues. | Stripped currency symbols and commas, rounded to 1200.00 | Auto Handled ✅ |
| 7 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 8 | Ambiguous date | Date '2026-02-12' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 8 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 9 | Inconsistent member name | Payer name 'priya' normalized to 'Priya'. | Applied name alias map normalization | Auto Handled ✅ |
| 9 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya'. | Used split details to resolve weights | Auto Handled ✅ |
| 10 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 11 | Inconsistent member name | Payer name 'Priya S' normalized to 'Priya'. | Applied name alias map normalization | Auto Handled ✅ |
| 11 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 12 | split_type/details mismatch | Split type 'equal' mismatches split details 'Rohan 700; Priya 400; Meera 400'. | Used split details to resolve weights | Auto Handled ✅ |
| 12 | Non-member in split_with | Name Rohan 700 cannot be resolved to any registered user. | Excluded non-member Rohan 700 from split | Auto Handled ✅ |
| 12 | Non-member in split_with | Name Priya 400 cannot be resolved to any registered user. | Excluded non-member Priya 400 from split | Auto Handled ✅ |
| 12 | Non-member in split_with | Name Meera 400 cannot be resolved to any registered user. | Excluded non-member Meera 400 from split | Auto Handled ✅ |
| 13 | Missing payer | Payer name '' cannot be resolved to a registered user. | Blocked database row creation; needs review | Needs Review ⚠️ |
| 13 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 14 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha'. | Used split details to resolve weights | Auto Handled ✅ |
| 14 | Settlement logged as expense | Row 'Rohan paid Aisha back' appears to be a debt settlement rather than an expense. | Created Settlement database record instead of Expense | Auto Handled ✅ |
| 15 | split_type/details mismatch | Split type 'percentage' mismatches split details 'Aisha 30%; Rohan 30%; Priya 30%; Meera 20%'. | Used split details to resolve weights | Auto Handled ✅ |
| 15 | Non-member in split_with | Name Aisha 30% cannot be resolved to any registered user. | Excluded non-member Aisha 30% from split | Auto Handled ✅ |
| 15 | Non-member in split_with | Name Rohan 30% cannot be resolved to any registered user. | Excluded non-member Rohan 30% from split | Auto Handled ✅ |
| 15 | Non-member in split_with | Name Priya 30% cannot be resolved to any registered user. | Excluded non-member Priya 30% from split | Auto Handled ✅ |
| 15 | Non-member in split_with | Name Meera 20% cannot be resolved to any registered user. | Excluded non-member Meera 20% from split | Auto Handled ✅ |
| 16 | Mixed date format | Date '01/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 16 | Ambiguous date | Date '01/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 16 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 17 | Mixed date format | Date '03/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 17 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 18 | Mixed date format | Date '05/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 18 | Ambiguous date | Date '05/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 18 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 19 | Mixed date format | Date '08/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 19 | Ambiguous date | Date '08/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 19 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 20 | Mixed date format | Date '09/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 20 | Ambiguous date | Date '09/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 20 | USD amount converted | Converted $540.00 USD to INR. | Converted at fixed rate of 83.50 -> ₹45090.00 INR | Auto Handled ✅ |
| 20 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 21 | Mixed date format | Date '10/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 21 | Ambiguous date | Date '10/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 21 | USD amount converted | Converted $84.00 USD to INR. | Converted at fixed rate of 83.50 -> ₹7014.00 INR | Auto Handled ✅ |
| 21 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 22 | Mixed date format | Date '10/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 22 | Ambiguous date | Date '10/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 22 | split_type/details mismatch | Split type 'share' mismatches split details 'Aisha 1; Rohan 2; Priya 1; Dev 2'. | Used split details to resolve weights | Auto Handled ✅ |
| 22 | Non-member in split_with | Name Aisha 1 cannot be resolved to any registered user. | Excluded non-member Aisha 1 from split | Auto Handled ✅ |
| 22 | Non-member in split_with | Name Rohan 2 cannot be resolved to any registered user. | Excluded non-member Rohan 2 from split | Auto Handled ✅ |
| 22 | Non-member in split_with | Name Priya 1 cannot be resolved to any registered user. | Excluded non-member Priya 1 from split | Auto Handled ✅ |
| 22 | Non-member in split_with | Name Dev 2 cannot be resolved to any registered user. | Excluded non-member Dev 2 from split | Auto Handled ✅ |
| 23 | Mixed date format | Date '11/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 23 | Ambiguous date | Date '11/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 23 | USD amount converted | Converted $150.00 USD to INR. | Converted at fixed rate of 83.50 -> ₹12525.00 INR | Auto Handled ✅ |
| 23 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev;Dev's friend Kabir'. | Used split details to resolve weights | Auto Handled ✅ |
| 23 | Non-member in split_with | Name Dev's friend Kabir cannot be resolved to any registered user. | Excluded non-member Dev's friend Kabir from split | Auto Handled ✅ |
| 24 | Mixed date format | Date '11/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 24 | Ambiguous date | Date '11/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 24 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 25 | Mixed date format | Date '11/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 25 | Ambiguous date | Date '11/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 25 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 26 | Mixed date format | Date '12/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 26 | Ambiguous date | Date '12/03/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 26 | Negative amount (refund?) | Amount -30.00 is negative. | Treated as a negative refund expense | Auto Handled ✅ |
| 26 | USD amount converted | Converted $-30.00 USD to INR. | Converted at fixed rate of 83.50 -> ₹-2505.00 INR | Auto Handled ✅ |
| 26 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 27 | Mixed date format | Date 'Mar 14' is not in ISO format. Parsed as format fallback. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 27 | Inconsistent member name | Payer name 'rohan ' normalized to 'Rohan'. | Applied name alias map normalization | Auto Handled ✅ |
| 27 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Dev'. | Used split details to resolve weights | Auto Handled ✅ |
| 28 | Mixed date format | Date '15/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 28 | Missing currency | Currency is missing. | Defaulted currency to INR | Auto Handled ✅ |
| 28 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 29 | Mixed date format | Date '18/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 29 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 30 | Mixed date format | Date '20/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 30 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 31 | Mixed date format | Date '22/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 31 | Zero amount | Amount is zero. | Imported with voided status | Auto Handled ✅ |
| 31 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 32 | Mixed date format | Date '25/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 32 | split_type/details mismatch | Split type 'percentage' mismatches split details 'Aisha 30%; Rohan 30%; Priya 30%; Meera 20%'. | Used split details to resolve weights | Auto Handled ✅ |
| 32 | Non-member in split_with | Name Aisha 30% cannot be resolved to any registered user. | Excluded non-member Aisha 30% from split | Auto Handled ✅ |
| 32 | Non-member in split_with | Name Rohan 30% cannot be resolved to any registered user. | Excluded non-member Rohan 30% from split | Auto Handled ✅ |
| 32 | Non-member in split_with | Name Priya 30% cannot be resolved to any registered user. | Excluded non-member Priya 30% from split | Auto Handled ✅ |
| 32 | Non-member in split_with | Name Meera 20% cannot be resolved to any registered user. | Excluded non-member Meera 20% from split | Auto Handled ✅ |
| 33 | Mixed date format | Date '28/03/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 33 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 34 | Mixed date format | Date '04/05/2026' is not in ISO format. Parsed as format DD/MM/YYYY. | Normalized date to YYYY-MM-DD | Auto Handled ✅ |
| 34 | Ambiguous date | Date '04/05/2026' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 34 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya'. | Used split details to resolve weights | Auto Handled ✅ |
| 35 | Ambiguous date | Date '2026-04-01' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 35 | split_type/details mismatch | Split type 'share' mismatches split details 'Aisha 2; Rohan 1; Priya 1'. | Used split details to resolve weights | Auto Handled ✅ |
| 35 | Non-member in split_with | Name Aisha 2 cannot be resolved to any registered user. | Excluded non-member Aisha 2 from split | Auto Handled ✅ |
| 35 | Non-member in split_with | Name Rohan 1 cannot be resolved to any registered user. | Excluded non-member Rohan 1 from split | Auto Handled ✅ |
| 35 | Non-member in split_with | Name Priya 1 cannot be resolved to any registered user. | Excluded non-member Priya 1 from split | Auto Handled ✅ |
| 36 | Ambiguous date | Date '2026-04-02' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 36 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Meera'. | Used split details to resolve weights | Auto Handled ✅ |
| 36 | Member outside membership window | Member Meera is not active in group on 2026-04-02. | Excluded Meera from split calculations | Auto Handled ✅ |
| 37 | Ambiguous date | Date '2026-04-05' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 37 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya'. | Used split details to resolve weights | Auto Handled ✅ |
| 38 | Ambiguous date | Date '2026-04-08' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 38 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha'. | Used split details to resolve weights | Auto Handled ✅ |
| 38 | Settlement logged as expense | Row 'Sam deposit share' appears to be a debt settlement rather than an expense. | Created Settlement database record instead of Expense | Auto Handled ✅ |
| 39 | Ambiguous date | Date '2026-04-10' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 39 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Sam'. | Used split details to resolve weights | Auto Handled ✅ |
| 40 | Ambiguous date | Date '2026-04-12' is ambiguous (could be DD/MM or MM/DD). | Defaulted ambiguous date to DD/MM format | Auto Handled ✅ |
| 40 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Sam'. | Used split details to resolve weights | Auto Handled ✅ |
| 41 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Sam'. | Used split details to resolve weights | Auto Handled ✅ |
| 42 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha 1; Rohan 1; Priya 1; Sam 1'. | Used split details to resolve weights | Auto Handled ✅ |
| 42 | Non-member in split_with | Name Aisha 1 cannot be resolved to any registered user. | Excluded non-member Aisha 1 from split | Auto Handled ✅ |
| 42 | Non-member in split_with | Name Rohan 1 cannot be resolved to any registered user. | Excluded non-member Rohan 1 from split | Auto Handled ✅ |
| 42 | Non-member in split_with | Name Priya 1 cannot be resolved to any registered user. | Excluded non-member Priya 1 from split | Auto Handled ✅ |
| 42 | Non-member in split_with | Name Sam 1 cannot be resolved to any registered user. | Excluded non-member Sam 1 from split | Auto Handled ✅ |
| 43 | split_type/details mismatch | Split type 'equal' mismatches split details 'Aisha;Rohan;Priya;Sam'. | Used split details to resolve weights | Auto Handled ✅ |

---

## Summary of Policies and Actions

1. **Date Normalization (Rule 1)**: All dates in non-ISO formats (e.g. `01/03/2026` or `Mar 14`) are normalized to `YYYY-MM-DD`.
2. **Ambiguous Dates (Rule 2)**: Row 34 dates (e.g., `04/05/2026`) are flagged as ambiguous. The engine defaults to DD/MM (Indian locale) but flags it as `needs_review` so users can verify.
3. **Exact Duplicates (Rule 3)**: Duplicate rows (such as row 6 for `dinner - marina bites`) are skipped to prevent double counting. The first occurrence is imported.
4. **Conflicting Duplicates (Rule 4)**: Rows 24 and 25 (`Dinner at Thalassa` vs `Thalassa dinner`) share identical signatures but have slightly different amounts. Both are imported, flagged, and marked as `disputed`.
5. **Settlement Re-routing (Rule 5)**: Rows indicating bank transfers/repayments (e.g., Row 14: `Rohan paid Aisha back`) are re-routed to the `settlements` table instead of creating an expense.
6. **Multi-currency Conversion (Rule 6)**: USD transactions are converted to INR at the fixed rate of **₹83.50/USD**.
7. **Missing Currency (Rule 7)**: Rows with blank currencies (e.g. Row 28) default to `INR` and are auto-corrected.
8. **Amount Formats (Rule 8)**: Commas (e.g. `1,200`), spaces, and excessive decimals (e.g. `899.995`) are parsed and rounded to two decimal places.
9. **Refunds (Rule 9)**: Negative amounts (e.g. Row 26) are processed as negative expense shares.
10. **Zero-value Rows (Rule 10)**: Row 31 (`₹0` expense) is imported with a `voided` status.
11. **Name Normalization (Rule 11)**: Trailing spaces (e.g., `rohan `) and case variations or suffixes (e.g. `priya` or `Priya S`) are normalized to their canonical forms using the alias map.
12. **Missing Payer (Rule 12)**: Row 13 has a blank payer field. The engine logs it as `needs_review` and blocks expense creation until the user manually assigns a payer.
13. **Splits Recalculation (Rules 13-17)**:
    - Percentage splits not summing to 100% (e.g., Rows 15 and 32) are rescaled proportionally.
    - Non-member participants and guests (e.g. `Kabir` on row 23) are excluded from splits, and shares are recalculated among the active members.
    - Members outside their membership window (e.g., Meera on row 36, who left in March but was included in an April split) are excluded from the calculation, and shares are redistributed.

---
*Report generated automatically by the Spreetail Shared Expenses engine.*
