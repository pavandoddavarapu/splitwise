# AI_USAGE.md

Documents AI tool usage, key prompts, and cases where AI output was wrong.
Updated continuously. At least 3 documented AI mistakes required as a deliverable.

---

## Tools used

| Tool | Purpose |
|------|---------|
| Antigravity (Claude Sonnet 4.6 Thinking) | Primary development collaborator — architecture, code generation, explanations |

---

## Key prompts

*(To be populated as the project progresses — record any prompt that produced a
non-trivial design decision or significant code block.)*

---

## Documented AI mistakes

*(Minimum 3 required. Record each case where AI output was wrong and had to be corrected.)*

| # | Step | What AI got wrong | Correction applied |
|---|------|------------------|--------------------|
| 1 | Pre-Step 1 | Summarized "Hard Requirements" as "no ORMs" — incorrect; the constraint is "relational DB only, no NoSQL". ORMs are expected and used. | Human corrected; notes updated. |
| 2 | Pre-Step 1 | Summarized auth as "bcrypt + session cookie" — stale from original brief, not the agreed stack. | Human corrected; stack section already had the right info (Django native hashing + DRF Token). |
| — | — | *(to be continued)* | — |
