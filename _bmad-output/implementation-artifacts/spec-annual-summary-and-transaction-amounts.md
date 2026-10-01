---
title: 'Planned/actual transaction amounts + Annual Summary tab'
type: 'feature'
created: '2026-09-29'
status: 'in-progress'
baseline_commit: '1c22383b0382fb206f1913feda8fcfc99274f0b8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/features/transactions.feature'
  - '{project-root}/_bmad-output/planning-artifacts/features/annual-summary.feature'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A transaction stores one `amount`, so the app can't tell what was planned from what was actually paid. The fourth tab (Annual Summary) is still a placeholder.

**Approach:** Replace `amount` with `plannedAmount` + `actualAmount` on `Transaction`, following the rules in `transactions.feature`. Then build the Annual Summary screen specified in `annual-summary.feature` on top of those two amounts: FY selector, yearly totals card, monthwise table and category table.

## Boundaries & Constraints

**Always:**
- Planned for a period = sum of `plannedAmount` over the rule occurrences that were computed, the stored planned rows and the completed rows. Committed = sum of `actualAmount` over rows with `statusKind: 'actual'`. Net = income − expense for each. Committed can exceed planned.
- Created directly as Completed → `plannedAmount = 0`, `actualAmount` = the entered value.
- Completing a planned row (stored or virtual) keeps its `plannedAmount`. `actualAmount` defaults to `plannedAmount` unless the user edits it.
- A completed rule occurrence counts once. Its virtual occurrence stays suppressed by `ruleGroupId`, as today.
- Amounts stay inside `cipherPayload` (architecture §8.1).
- The FY runs April–March and is labelled `FY 2026–27` (en dash). Transactions are bucketed by `date`/`monthKey`.
- Screens stay presentational and store-bound. The aggregation math is a pure, unit-tested function.
- **Decision: persisted FY summary document.** The screen reads one encrypted summary document per FY from a new Dexie table (`fySummaries`, schema v2, purely additive). Services emit a domain event after every transaction write (covering the FY of the old and new date) and every rule write (create, revise, status, delete; covers every FY that has a document, plus the current FY). A handler recomputes the affected documents with the pure aggregator. The emit is awaited, so a write resolves only after its documents are up to date. A missing document is built on first read. Documents store figures by `categoryId`; names, icons and colours are resolved at render. Documents are derived data, so they never enter the sync outbox.
- **Decision: undo.** A row created directly as Completed keeps `plannedAmount = 0` when it's moved back to Planned.
- **Decision: Cashflow matches Annual Summary.** Rows show `actualAmount` when completed and `plannedAmount` otherwise. Card headline = committed, "Planned" subtext = sum of `plannedAmount`. Projected balance = sum over rows of (actual if completed, else planned), income − expense.

**Never:**
- Don't fetch prior FYs from Firestore; that isn't built in v1, so every month is read locally.
- Don't add a charting library, change how the rule engine versions or schedules rules, or edit the `.feature` files.
- Don't recompute the summary inside a screen or store; it happens only in the service-layer event handler and on the first read.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rule, never completed | monthly 1,000 expense, active all FY | planned +12,000; committed +0 | N/A |
| Rule occurrence completed at a different amount | Aug occurrence completed for 1,200 | Aug planned +1,000, committed +1,200, counted once | N/A |
| Direct completed | 3,000 expense created as Completed in Oct | Oct planned +0, committed +3,000 | N/A |
| Adhoc planned | 5,000 planned in Jun | Jun planned +5,000, committed +0 | N/A |
| Undo completed | completed 2,000 in Nov moved to Planned | Nov committed −2,000; planned unchanged (a row created as Completed stays at planned 0) | N/A |
| Event recompute | transaction's date moved from Mar 2027 to Apr 2027 | both FY 2026–27 and FY 2027–28 documents are updated before the save resolves | N/A |
| Rule change | rule revised or paused | every stored FY document and the current FY are recomputed | N/A |
| No document yet | open an FY that has never been summarised | built from data, saved, then shown | N/A |
| Paused / cancelled rule | either one | contributes nothing in any month | N/A |
| Mid-FY revision | 1,000 → 1,100 effective 1 Oct | Apr–Sep 1,000, Oct–Mar 1,100, never both | N/A |
| FY boundary | 31 Mar 2027 vs 1 Apr 2027 | Mar of FY 2026–27 vs Apr of FY 2027–28 | N/A |
| Deleted category | row references an unknown `categoryId` | "Uncategorised" row; section totals still equal the yearly totals | N/A |
| Empty FY | no data at all | zeros in the card, 12 zero months, "Nothing planned for this year yet" | N/A |

**Decision (human, 2026-09-30):** no legacy-record handling. Development starts from a clean database, so existing rows with only `amount` aren't supported.

</frozen-after-approval>

## Code Map

- `src/models/Transaction.ts` -- replace `amount` with `plannedAmount: number` + `actualAmount?: number`.
- `src/repositories/dexie/encrypting/EncryptingTransactionRepository.ts` -- encrypted field list (`plannedAmount`, `actualAmount` in place of `amount`). No legacy mapping.
- `src/repositories/interfaces/TransactionRepository.ts`, `src/repositories/dexie/DexieTransactionRepository.ts` -- add `getByMonthRange(fromKey, toKey)` using `where('monthKey').between(…, true, true)`.
- `src/services/RuleEngineService.ts:94` -- virtual occurrence sets `plannedAmount: version.amount`. The scheduling logic doesn't change.
- `src/services/TransactionService.ts` -- `create`/`update` apply the amount rules. Pull the stored-vs-virtual merge from `getForMonth` out into a pure helper so the FY path can reuse it.
- `src/services/BalanceService.ts` -- `summarizeTransactions` moves to planned/actual. Add pure `summarizeFiscalYear(transactions, fyStartYear)` and async `buildAnnualSummary(fyStartYear)`: one `ruleRepository.getAll()`, 12× `computeVirtualPlannedTransactions`, one `getByMonthRange`.
- NEW `src/models/FiscalYearSummary.ts` -- document shape: `fyStartYear`, 12 months × {income, expense} × {planned, committed}, and per-type `categoryId` → {planned, committed}.
- NEW `src/services/domainEvents.ts` -- a tiny typed emitter with an awaited `emit`: `transactionsChanged {dates}` and `rulesChanged`.
- NEW `src/services/FiscalYearSummaryService.ts` -- subscribes to the events, recomputes and saves documents; `get(fyStartYear)` builds on a miss.
- NEW `src/repositories/{interfaces,dexie,dexie/encrypting}/…FiscalYearSummary…` -- repository following the transaction one: clear `fyStartYear`/`updatedAt`, figures in `cipherPayload`; wired in `repositories/index.ts`.
- `src/repositories/dexie/db.ts` -- `version(2)` adds `fySummaries: 'fyStartYear, updatedAt'`; the v1 stores are unchanged. `src/test/dbTestUtils.ts` clears the new table.
- `src/services/RuleService.ts:88-175` -- emit `rulesChanged` after `create`, `revise`, `setStatus` and `deleteLineage` (not after the `list()` expiry stamp, which doesn't change occurrences).
- `src/screens/sheets/TransactionFormSheet.tsx` -- amount fields (see Design Notes).
- `src/screens/Cashflow/TransactionRow.tsx`, `CashflowScreen.tsx` -- show the right amount.
- `src/utils/date.ts:26` -- `fiscalYearLabel` switches to an en dash; check `date.test.ts` and every caller.
- `src/utils/currency.ts` -- add a compact formatter (`en-IN`, `notation: 'compact'`).
- `src/stores/uiStore.ts`, `src/app/AppShell.tsx:31` -- render `AnnualSummaryScreen` in place of the placeholder.
- `src/stores/transactionStore.ts` -- `loadMonth` is reused when a month row is tapped (Cashflow reloads the store's year/month when it mounts).
- Reuse: `utils/metadata` (`getCategoryGroups`, `findCategoryGroup`), `IconBadge`, `Icon` chevrons, `MonthSelector` styling, `index.css` tokens.
- Don't change: rule versioning/status logic, the existing v1 store definitions, `CryptoService`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/models/Transaction.ts` -- amount fields -- the base of both features
- [ ] `src/repositories/**/Transaction*.ts` -- encrypted fields, `getByMonthRange` -- the FY read
- [ ] `src/services/RuleEngineService.ts`, `TransactionService.ts` -- `plannedAmount` on virtual rows; create/update/complete/undo rules; extract the merge helper
- [ ] `src/services/BalanceService.ts` -- month summary + `summarizeFiscalYear` / `buildAnnualSummary` returning yearly, monthly and per-type category totals
- [ ] `src/models/FiscalYearSummary.ts`, `src/repositories/**/…FiscalYearSummary…`, `db.ts` v2 -- the persisted, encrypted document
- [ ] `src/services/domainEvents.ts`, `FiscalYearSummaryService.ts`; emits in `TransactionService` and `RuleService` -- event-driven recompute, built on a miss
- [ ] `src/stores/annualSummaryStore.ts` -- `fyStartYear` (defaults to `fiscalYearStart(today)`, kept across tab switches), `summary`, `load`, `go(delta)`
- [ ] `src/screens/AnnualSummary/*` -- `AnnualSummaryScreen`, `FiscalYearSelector`, `AnnualTotalsCard`, `MonthlyBreakdownTable`, `CategoryBreakdownTable` + CSS modules
- [ ] `src/app/AppShell.tsx` -- mount the screen
- [ ] `src/screens/sheets/TransactionFormSheet.tsx`, `src/screens/Cashflow/*` -- amount inputs and display
- [ ] `src/utils/date.ts`, `currency.ts` -- en-dash label, compact formatter
- [ ] `src/services/*.test.ts`, `src/repositories/**/*.test.ts`, `src/screens/AnnualSummary/*.test.tsx` -- every I/O-matrix row, the amount rules, FY selection and navigation
- [ ] `_bmad-output/planning-artifacts/architecture.md` §2.3, §2.5 note, §6.1, §7 -- record the new fields, the revised definitions ("committed ≤ planned" is no longer true), and the persisted, event-driven FY summary

**Acceptance Criteria:**
- Given today is 15 Feb 2027, when the tab opens, then it shows `FY 2026–27`, and the chevrons move one FY at a time.
- Given a non-current FY is selected, when I switch tabs and come back, then the same FY is still shown.
- Given any data, then each yearly figure = the sum of the 12 month rows, and each category section total = the matching yearly total.
- Given categories in a section, then they're sorted by planned descending, zero rows are hidden, and each shows its planned share % of the section.
- Given a negative net, then it shows a minus sign in the expense colour.
- Given the selected FY contains today, then the current month row is highlighted; tapping "Aug 2026" opens Cashflow on August 2026.
- Given a 390px-wide screen, then the monthwise table uses compact amounts and its month column stays pinned while scrolling sideways.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Sheet amount fields:** while Status is Planned, show one "Amount" field (= planned). While Completed, show "Planned amount" + "Actual amount", with actual pre-filled from planned. "Planned amount" is hidden when creating a new row directly as Completed, since planned is forced to 0.
- **Undo:** `actualAmount` is cleared when a row moves back to Planned, and `plannedAmount` is left as it is (0 for a row created as Completed).
- **Event wiring:** `FiscalYearSummaryService` registers its handler when the module is imported. `TransactionService`/`RuleService` import only `domainEvents`, which avoids an import cycle; `AppShell` (or the store) imports the summary service so the handler is registered at runtime, and tests import it explicitly.
- **Scenario title vs body:** "A completed amount that differs from the rule *replaces* the rule amount in planned" contradicts its own steps. The steps win (planned keeps 1,000, committed 1,200) because they match the Always rules.
- **Categories:** section = transaction `type`. Colour and icon come from the `MetadataGroup` at render time, so a rename or recolour shows on the next open.

## Verification

**Commands:**
- `npx vitest run` -- expected: all pass, including the new FY / amount tests
- `npx tsc -b --noEmit` -- expected: no errors
- `npx eslint .` -- expected: no new errors

**Manual checks (if no CLI):**
- `npm run dev` at 390px width: open the Summary tab, change FY, tap a month row, and complete / undo a transaction, checking the figures after each.
