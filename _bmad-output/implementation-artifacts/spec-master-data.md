---
title: 'Master Data: sub-categories, payment instruments, fixed status, archive-never-delete'
type: 'feature'
created: '2026-10-01'
status: 'done'
baseline_commit: '1c22383b0382fb206f1913feda8fcfc99274f0b8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/features/master-data.feature'
  - '{project-root}/_bmad-output/planning-artifacts/architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Transactions and rules record a top-level category, a cosmetic status label and loose account/payment-mode ids, and the Master Data tab is a placeholder. The domain vocabulary was settled on 2026-10-01 (`master-data.feature`, architecture §2.2), and the code doesn't follow it yet.

**Approach:** Move the model to "leaf only": `subCategoryId` + optional `instrumentId`, with parents derived. Remove the status label. Add archive-never-delete with `firstUsedAt`. Update the sheets, rows and Annual Summary roll-up. Build the Master Data screen (categories → sub-categories, fixed payment modes → instruments) as the feature specifies.

## Boundaries & Constraints

**Always:**
- `master-data.feature` and architecture §2.2 are the behaviour contract. The updated `transactions.feature`, `annual-summary.feature` and `recurring-rules-*.feature` apply too.
- Transactions and rules store only `subCategoryId` (required) and `instrumentId` (optional). Category and payment mode are derived through one item → group lookup and never stored.
- Rule chain-breaking fields are `name`, `subCategoryId` and `type`. An `instrumentId` change is a new version in the same lineage. Completing an occurrence pre-fills the rule's instrument, which can be changed for that transaction only.
- `firstUsedAt` is stamped on the sub-category, its category and the instrument the first time a transaction or rule version references them, and is never cleared. Permanent delete is allowed only while it's unset; otherwise removal archives.
- Validation lives in `MetadataService` (unique sibling names ignoring case, `last4` exactly 4 digits, no digit run longer than 4 in a label, fixed payment modes are immutable, the system Cash instrument is immutable). Sheets display its error messages.
- The FY summary stores figures by `subCategoryId`. The category roll-up happens at render and includes archived categories.
- Starting from a clean database: no legacy mapping or data migration. A Dexie version bump changes indexes only.

**Never:**
- No account balances, transfers, custom enumeration groups, reordering UI, or moving a leaf to another parent.
- Don't store a full card or account number anywhere.
- Don't edit the `.feature` files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Leaf only | save transaction with House Rent + Regalia ••4321 | stores `subCategoryId`, `instrumentId`; shows Housing and Credit Card (derived) | N/A |
| Duplicate sibling | add "grocery" under Essentials, which has "Grocery" | nothing saved | "A sub-category with this name already exists in Essentials" |
| Same name, other parent | "Insurance" under Essentials and under Protection | both saved | N/A |
| Remove used | sub-category with `firstUsedAt` set | archived: hidden from pickers, history keeps its name and totals | N/A |
| Remove never used | `firstUsedAt` unset | "Delete permanently" offered; gone after confirming | N/A |
| Used then the transaction is deleted | create transaction, delete it, remove the sub-category | archive only | N/A |
| Archive category | category with sub-categories | the category and all its sub-categories archived | N/A |
| Restore sub-category | its parent is archived | both restored | N/A |
| Empty category | no active sub-category | not offered in pickers | N/A |
| last4 | "43210" or "43a1" | nothing saved | "Enter exactly the last 4 digits" |
| Full number | nickname "Regalia 4532015112830366" | nothing saved | "Don't store full card or account numbers — use a nickname and the last 4 digits" |
| Fixed modes | rename / archive / delete / add a payment mode | refused; no UI offers it | service throws |
| System Cash | rename / archive / delete "Cash" | refused; no UI offers it | service throws |
| Rule instrument | complete an occurrence of a rule with Regalia | instrument pre-filled; changing it doesn't change the rule | N/A |
| Rule edit | change sub-category vs change instrument | new lineage vs new version | N/A |
| Archived on a rule | the rule's sub-category gets archived | rule still plans; its sheet keeps the current value | N/A |
| Summary roll-up | two sub-categories of Housing, one of them archived | one Housing row = their sum | N/A |
| Unknown id | `subCategoryId` doesn't resolve | "Uncategorised" row; totals intact | N/A |
| Status | open the Status control | only Planned / Completed; no label picker | N/A |

</frozen-after-approval>

## Code Map

- `src/models/MetadataGroup.ts` -- the §2.2 shapes: `key: 'category'|'paymentMode'`, `systemCode`, `archived`, `firstUsedAt`, `order`; the item gets `last4`, `isSystem`, `firstUsedAt`.
- `src/models/Transaction.ts`, `RecurringRule.ts` -- `categoryId` → `subCategoryId`; drop `statusLabelId`/`accountId`/`paymentModeId`; add `instrumentId?`.
- `src/repositories/dexie/StoredRecords.ts`, `db.ts` -- clear column `subCategoryId`; `version(3)` re-declares the `transactions`/`rules` indexes with `subCategoryId`. `instrumentId` goes inside `cipherPayload`.
- `src/repositories/dexie/encrypting/Encrypting{Transaction,Rule}Repository.ts` -- field lists.
- `src/data/seedMetadata.ts` -- starter categories (existing list) + six fixed payment-mode groups with `systemCode`, and a system "Cash" item under Cash. No status or account groups.
- `src/services/MetadataService.ts` -- category/sub-category/instrument create, rename and recolour; archive, restore and permanent delete (only while unused); `markUsed(ids)`; all validation. Keep it pure where practical (a `validateLabel` helper).
- `src/utils/metadata.ts` -- replace the label helpers with an index: `resolveLeaf(groups, itemId) → {group, item} | undefined`, `pickableSubCategories`, `pickableInstruments` (active only, plus an optional current value even if archived), `formatInstrument` ("label ••1234").
- `src/services/TransactionService.ts`, `RuleService.ts` -- the new fields; call `MetadataService.markUsed` on create/update/revise. `RuleService` chain-breaking list → `subCategoryId`.
- `src/services/RuleEngineService.ts:94` -- virtual occurrences carry `subCategoryId` and `instrumentId`.
- `src/services/BalanceService.ts`, `src/models/FiscalYearSummary.ts` -- the per-type map is keyed by `subCategoryId`.
- `src/utils/annualSummary.ts` -- `buildCategorySection` rolls leaves up to their group via `resolveLeaf`, archived groups included; unresolved → Uncategorised.
- `src/screens/sheets/TransactionFormSheet.tsx`, `RuleFormSheet.tsx` -- sub-category select with `<optgroup>` per category; instrument select with an `<optgroup>` per mode plus "None"; the status-label select is removed; the virtual-completion path passes the rule's `instrumentId`.
- `src/screens/Cashflow/TransactionRow.tsx`, `src/screens/Rules/RuleRow.tsx` -- show "Category › Sub-category"; the row shows the instrument (if any) in place of the status pill.
- NEW `src/screens/MasterData/*` -- `MasterDataScreen`, `TotalCategoriesCard`, `CategoryGrid`/`CategoryCard`, `PaymentModeList`, a "Show archived" toggle + CSS modules. NEW `src/screens/sheets/CategoryFormSheet.tsx` (category fields + its sub-category list: add, rename, archive/restore/delete) and `InstrumentFormSheet.tsx`.
- `src/stores/uiStore.ts` (`SheetType` + `'instrument'`), `src/stores/metadataStore.ts` (mutating actions wrap `MetadataService`, then refresh), `src/app/SheetHost.tsx`, `src/app/AppShell.tsx` (mount the screen).
- Tests to update: `src/services/*.test.ts`, `src/utils/annualSummary.test.ts`, `src/screens/AnnualSummary/AnnualSummaryScreen.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `src/models/*` -- new Master Data, Transaction and Rule fields -- the foundation
- [x] `src/repositories/dexie/*`, `encrypting/*` -- stored shapes, v3 indexes
- [x] `src/data/seedMetadata.ts` -- new seed
- [x] `src/utils/metadata.ts` -- leaf index and picker helpers
- [x] `src/services/MetadataService.ts` -- management, validation, `markUsed`, archive/restore/delete
- [x] `src/services/{Transaction,Rule,RuleEngine,Balance}Service.ts`, `src/utils/annualSummary.ts` -- new fields, usage stamping, roll-up
- [x] `src/stores/{metadata,ui}Store.ts`, `src/app/{SheetHost,AppShell}.tsx` -- wiring
- [x] `src/screens/sheets/{Transaction,Rule}FormSheet.tsx`, `src/screens/{Cashflow/TransactionRow,Rules/RuleRow}.tsx` -- pickers and display
- [x] `src/screens/MasterData/*`, `src/screens/sheets/{Category,Instrument}FormSheet.tsx` -- the screen and sheets
- [x] `src/services/MetadataService.test.ts`, `src/utils/metadata.test.ts`, updated service/summary tests, `src/screens/MasterData/MasterDataScreen.test.tsx` -- every matrix row

**Acceptance Criteria:**
- Given first run, then the starter categories with sub-categories, six payment modes and the Cash instrument exist; a later change is not re-seeded.
- Given 6 active and 1 archived category, then the total-categories card shows 6.
- Given I add a sub-category, then it's pickable on a transaction and a rule without reloading.
- Given a rename or recolour, then past transactions, rules and Annual Summary show the new name and colour.
- Given the Master Data screen, then there's no Status section, and payment modes offer no add, rename, archive or delete.

## Implementation Notes

- Implemented inline (no subagent, per the user's choice). The baseline commit predates the uncommitted planned/actual + Annual Summary build, so a diff against the baseline includes that work too.
- Leaf lookup: `utils/metadata.ts` builds a `WeakMap`-cached item → `{group, item}` index per groups array. `pickableLeaves`/`leafOptions` feed a new shared `components/GroupedSelectField.tsx` (one `<optgroup>` per parent), used by both sheets.
- `MetadataService.markUsed` runs after every transaction create/update and rule create/revise. Master Data screen refreshes on mount, so Remove sees fresh `firstUsedAt`; the service re-checks from storage, so a stale UI can only ever archive, never wrongly delete.
- `ActiveSheet` gained `parentId` (create an instrument under a mode). Creating a category re-opens the sheet in edit mode so sub-categories can be added straight away.
- Dexie `version(3)` re-declares the `transactions`/`rules` indexes on `subCategoryId`; v1/v2 left as history.
- Self-check done without writing a diff file (the user rejected that command in the previous build); checked against the spec, every task and acceptance criterion, and the matrix by test.
- Matrix coverage: `MetadataService.test.ts` (seed, duplicates, same name, last4, full number, fixed modes, Cash, archive/delete/used-then-deleted, category cascade, restore), `utils/metadata.test.ts` (leaf derivation, empty category, archived current value), `RuleService.test.ts` (sub-category → new lineage, instrument → new version), `TransactionService.test.ts` (leaf-only storage, rule instrument pre-fill, archived sub-category on a rule), `utils/annualSummary.test.ts` (roll-up incl. archived, unknown id), `MasterDataScreen.test.tsx` (no Status section, total card, fixed modes, instrument display, validation message, remove flow, picker without reload, two-value status). Verification: `npx vitest run` 105/105, `tsc` clean, `eslint` clean.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-01), 3 layers (blind, edge-case, verification-gap); 34 raw findings, deduplicated below. No intent_gap/bad_spec, so no loopback.

| # | Finding (layers) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | Derived-data failure rejects a save that already persisted; sheet stays submitting (E, B, V) | medium | `TransactionService` awaits `markUsed`/`emit` after `save`; `handleSubmit` had no try/finally | patch: `emit` logs handler errors; sheet try/catch/finally |
| 2 | Full number with spaces/dashes passes `\d{5,}` (E, B) | medium | "4532 0151 1283 0366" has no 5-digit run; breaks the "never saved" scenario | patch: ignore separators between digits; tests added |
| 3 | Derived payment mode never shown (B) | medium | Feature/matrix say it shows "Credit Card"; row and rule view showed the instrument only | patch: `describeInstrument` ("Credit Card · …") in row + rule read-only view |
| 4 | Completed rule occurrence moved to another month double-counts (E, B) | medium | `mergeStoredWithVirtual` claims by `ruleGroupId` within the row's current month; pre-dates this story (Cashflow `getForMonth`) | defer |
| 5 | Amount lost toggling a new entry Completed → Planned (E, B) | low | Field rebinds to empty `plannedAmount` | patch: copy actual → planned for new entries; test added |
| 6 | Duplicate check blocks re-adding the name of an archived (hidden) sibling with a misleading message (E) | low | `validateLabel` counts archived siblings | patch: "archived entry … exists — restore it instead"; test added |
| 7 | `describeSubCategory` labels a payment leaf as a category (E) | low | Missing `key === 'category'` check, unlike `TransactionRow` | patch; test added |
| 8 | Architecture §6.1 shows `subCategoryId` in v1; §9 numbering out of order (B) | low | Code: v1 `categoryId`, v2 `fySummaries`, v3 re-index | patch: §6.1 shows the v1→v3 history; §9 reordered |
| 9 | Usage stamping via `revise` / `update` untested (V) | gap | Pre-verified by layer: removing either `markUsed` call passes all tests | patch: 2 tests |
| 10 | `restoreCategory`, duplicate category names, `updateItem` untested (V) | gap | Pre-verified by layer | patch: 3 tests |
| 11 | TransactionFormSheet amount handling untested (V) | gap | Pre-verified by layer | patch: jsdom tests (unplanned completion saves 0/300, toggle keeps value, completion pre-fill) |
| 12 | TransactionRow amount display untested (V) | gap | Pre-verified by layer | patch: row test (₹3,000 for an unplanned completion + derived mode) |
| 13 | Cashflow card / Annual Summary table column wiring untested (V) | gap | Layer filed as defer: low-logic wiring | defer |
| 14 | New forms silently pre-select the first sub-category (B) | low | Pre-existing pattern (the old form pre-selected the first category); now riskier with ~30 leaves | defer |
| 15 | No data upgrade for existing installs (E, B, V) | false | Human decision 2026-09-30: clean database, no legacy handling (memory + spec Always) | reject |
| 16 | `restoreCategory` also restores items archived individually (E, B) | low | Real but needs a new tracking field; rare sequence | reject (low, fix adds state) |
| 17 | Concurrent FY recomputes may save out of order (E) | low | UI awaits each save; overlapping writes are not reachable in normal use | reject (fix adds a queue) |
| 18 | `annualSummaryStore.load` has no error state (E, B) | low | Rejects only on decrypt/DB failure, when the app is effectively locked | reject (fix adds state + UI) |
| 19 | Remove/restore handlers in Master Data sheets lack try/catch (E, B) | low | UI never offers the throwing paths; only a stale store could reach them | reject (adds guards; rare) |
| 20 | `markUsed` read-modify-write can race a Master Data edit (E, B) | low | Needs a save and a Master Data edit in the same instant; not reachable via the UI | reject |
| 21 | Summary handler registered as an import side effect (B) | low | Works today (AppShell → store → service; tests import it); no failing path shown | reject |
| 22 | Feature files: typos, non-Gherkin lines, title/body contradiction (B) | false | `.feature` files are the user's and out of scope (spec Never) | reject (reported to user) |
| 23 | Editing a direct completion lets planned be changed from 0 (B) | false | Spec Design Notes: both amounts are editable once a row exists | reject |
| 24 | Month table `tr role="button"` loses row semantics (B) | low | Real a11y wart; single-user app, fix restructures the table | reject |
| 25 | `TransactionRow` imports `BalanceService` (B) | low | Pure function import, same pattern `CashflowScreen` already used | reject |
| 26 | `markUsed` scans all groups on every save (B) | low | ~12 small groups; negligible | reject |

## Design Notes

- **Leaf lookup:** build the item-id → `{group, item}` map once per groups array (memoised in the selectors), and use it for rows, sheets and the summary.
- **Deletion check:** `firstUsedAt` is the only source of truth. Stored transactions aren't scanned, since a deleted transaction leaves no trace (architecture §2.2).
- **Remove action UI:** one "Remove" button. If the entry is used, it archives immediately with the notice "In use — archived, not deleted". If unused, it switches to a confirm step "Delete permanently".
- **Rows:** Upcoming/Completed sections already show status, so the row pill now shows the instrument ("HDFC Regalia ••4321") when there is one.
- **Order:** groups and items are sorted by `order` (creation order). There's no reordering UI.

## Verification

**Commands:**
- `npx vitest run` -- expected: all pass
- `npx tsc -b --noEmit` -- expected: no errors
- `npx eslint .` -- expected: no errors

**Manual checks (if no CLI):**
- `npm run dev` on a clean database at 390px: add/archive/restore/delete a sub-category and an instrument, record a transaction with an instrument, complete a rule occurrence, and open Annual Summary.
