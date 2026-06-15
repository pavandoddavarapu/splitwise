# AI_USAGE.md

Documents all AI tools used during development, key prompts that shaped the project, and concrete cases where the AI produced incorrect output that had to be caught and corrected.

---

## Tools Used

| Tool | Model | Purpose |
|------|-------|---------|
| Antigravity IDE Agent | Claude Sonnet 4.6 (Thinking) / Gemini 3.5 Flash | Primary development collaborator — architecture design, code generation, debugging, CSV pipeline logic, frontend components, deployment configuration |

**How AI was used**: The AI agent acted as a pair-programming partner. I described requirements and the AI generated code, which I then reviewed, tested, and corrected. All architectural decisions (see `DECISIONS.md`) were made by me with the AI proposing options. The AI had direct access to the codebase and could read/write files, run terminal commands, and push to Git.

---

## Key Prompts

These are the significant prompts that produced non-trivial design decisions or major code blocks:

### Prompt 1 — Initial scaffold and architecture
> "Build a shared expenses app for flatmates with Django + DRF backend, React frontend with Vite, deployed on Render. Use whitenoise to serve the React build. Set up the full database schema with 8 tables: users, groups, group_memberships, expenses, expense_shares, settlements, import_batches, import_anomalies."

**Result**: Generated the entire project scaffold, Django apps, model definitions with docstrings, `render.yaml` deployment config, and Vite proxy setup. This established the monorepo structure and single-origin deployment pattern (D-001, D-004).

### Prompt 2 — Balance calculation with live computation
> "Implement balance calculation. Balances must NEVER be stored — compute them live from expense_shares and settlements rows. Add a greedy settlement simplification algorithm and an audit drill-down that shows the exact formula."

**Result**: Generated `GroupBalancesView` and `UserBalanceDetailView` with Django ORM `annotate(Sum(...))` queries. The greedy algorithm pairs largest debtor with largest creditor iteratively. The drill-down view returns the complete trace: paid expenses, owed shares, settlements sent/received, and the net formula.

### Prompt 3 — CSV import pipeline with 17 anomaly rules
> "Implement the full CSV import pipeline. It must detect these 16+ anomaly types: mixed date formats, ambiguous dates, exact/conflicting duplicates, settlement detection, USD conversion, missing currency, amount formatting, negative amounts, zero amounts, inconsistent names, missing payer, percentage sum errors, split type mismatches, non-member splits, membership window violations, and excluded participants like Kabir."

**Result**: Generated the 570+ line `ImportUploadView` in `imports/views.py` with all detection rules, the `normalize_name()` alias map, `try_parse_date()` multi-format parser, and `parse_split_details()` for the various split detail formats. This was the largest single code generation in the project.

### Prompt 4 — Add Member modal with quick user registration
> "The Add Member modal only shows a dropdown of existing users. I need to be able to type a new name and create a user directly from the modal, so I can add flatmates like Aisha, Rohan, Priya without logging out and registering them separately."

**Result**: Added tabbed UI ("Existing User" / "Create New User") with auto-generated email from the name (e.g., typing "Aisha" auto-fills `aisha@example.com`), a default password, and inline registration via `POST /api/auth/register/` followed by automatic group membership creation. This solved a significant UX friction point.

### Prompt 5 — Fixing CSV column name matching and payer dropdown
> "The CSV columns named `paid_by` aren't being matched. Also the payer dropdown in the import anomaly resolution is empty — no users show up."

**Result**: AI identified two bugs: (1) `split_details` column was overwriting `split_with` in the column mapping because `"details" in "split_details"` matched the wrong condition — this was reordered to check `split_details` separately; (2) the payer dropdown was populated from group members API (which returned empty) instead of the all-users API. Both were fixed with targeted code changes.

---

## Documented AI Mistakes

**Minimum 3 required. Each entry describes what the AI got wrong, how it was caught, and the correction applied.**

### Mistake 1 — Mischaracterised "Hard Requirements" as "no ORMs"

| Field | Detail |
|-------|--------|
| **Step** | Pre-Step 1 (project planning) |
| **What AI got wrong** | When summarizing the project brief's hard requirements, the AI stated the constraint was "no ORMs allowed" — implying raw SQL must be used for all database access. |
| **What the brief actually said** | "Relational database only, no NoSQL." The constraint is about the *database type* (PostgreSQL, not MongoDB), not about how you access it. ORMs like Django ORM are expected and encouraged. |
| **How it was caught** | I re-read the brief and noticed the AI's summary contradicted the actual text. Using raw SQL for everything would have been unnecessarily complex. |
| **Correction applied** | Corrected the project notes. Proceeded with Django ORM as planned — it's the standard way to interact with PostgreSQL in Django. |

### Mistake 2 — Summarized auth as "bcrypt + session cookie" from stale brief

| Field | Detail |
|-------|--------|
| **Step** | Pre-Step 1 (project planning) |
| **What AI got wrong** | The AI carried forward the original brief's auth spec ("bcrypt + session cookie") into its working notes, even though we had already agreed to use Django's native PBKDF2-SHA256 + DRF TokenAuthentication. |
| **The actual agreed stack** | Django's built-in `PASSWORD_HASHERS` (PBKDF2-SHA256 by default) + DRF `TokenAuthentication` header-based auth. |
| **How it was caught** | I noticed the inconsistency during the DECISIONS.md review — the AI's planning notes said "bcrypt" but the actual code used Django's default hasher. |
| **Correction applied** | Updated all documentation to reflect the actual auth stack. No code changes needed — the AI had correctly implemented Django-native auth; only its notes were wrong. |

### Mistake 3 — Missing `getAvailableUsers()` function caused blank screen crash

| Field | Detail |
|-------|--------|
| **Step** | Step 3 (Groups + Memberships UI) |
| **What AI got wrong** | The AI generated the "Add Member" modal in `GroupsTab.jsx` that called `getAvailableUsers()` to filter the user dropdown — but this function was **never defined** anywhere in the component. When the modal opened, it threw a `ReferenceError`, which crashed React's rendering and produced a blank white screen. |
| **How it was caught** | After deploying to Render, clicking "+ Add Member" caused the entire page to go blank. Browser DevTools showed `ReferenceError: getAvailableUsers is not defined`. |
| **Correction applied** | Added the missing `getAvailableUsers()` helper function that filters the `users` array to exclude users who are already members of the selected group (by comparing user IDs against `selectedGroup.memberships.map(m => m.user.id)`). The function was placed alongside the existing `getActiveMembersOnDate()` helper. |

### Mistake 4 — CSV `split_details` column overwrote `split_with` in header mapping

| Field | Detail |
|-------|--------|
| **Step** | Steps 7–9 (CSV import pipeline) |
| **What AI got wrong** | In the header matching loop, the condition for detecting the "split details" column used `"details" in h`. But the CSV has two columns: `split_with` (column 6, containing participant names like `"Aisha;Rohan;Priya;Meera"`) and `split_details` (column 7, containing weights like `"Rohan 700; Priya 400; Meera 400"`). Because `"details" in "split_details"` is True, column 7 was matched — but the code assigned it to `col_map["participants"]`, **overwriting** the `split_with` column 6 that had just been correctly matched. This meant the participant list was lost for every row where `split_details` was empty. |
| **How it was caught** | During testing with the real CSV file, rows that had participants in `split_with` but empty `split_details` were being split among all active group members instead of just the listed participants. Tracing the column mapping logic revealed the overwrite. |
| **Correction applied** | Refactored the header matching to treat `split_with` and `split_details` as **separate keys** in `col_map`. The `split_details` condition now checks for `"details" in h` only AFTER excluding columns already matched as `split_with`. During row processing, both columns are read separately and combined: `split_with` provides the participant list, `split_details` provides the weights/percentages/amounts. If `split_details` is empty, the participants from `split_with` get an equal split. |

### Mistake 5 — Payer dropdown empty in import anomaly resolution modal

| Field | Detail |
|-------|--------|
| **Step** | Steps 7–9 (CSV import pipeline frontend) |
| **What AI got wrong** | The `ImportsTab.jsx` anomaly resolution UI (for "missing payer" anomalies) showed a dropdown to select who paid. The AI populated this dropdown from `groupMembers` — fetched via `GET /api/groups/<id>/members/`. But this API returns **membership objects** with nested user data (`{ id, group, user: { id, name, email }, joined_at, left_at }`), and the code was trying to access `m.name` directly (which doesn't exist on a membership object). Result: the dropdown was completely empty — no users appeared. |
| **How it was caught** | After importing the CSV, row 13 (missing payer: "House cleaning supplies") showed the anomaly correctly, but the resolution modal's payer dropdown was blank. I could not select anyone to approve the expense. Inspecting the API response showed that the membership objects had `user.name`, not `name` directly. |
| **Correction applied** | Changed the data source from group members API to the all-users API (`GET /api/auth/users/`), which returns flat user objects `{ id, name, email }`. The dropdown now correctly shows all registered users. Additionally, the resolution payload was updated to include `group_id` so the backend can verify membership when the payer is selected. |
