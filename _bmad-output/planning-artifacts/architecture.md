---
title: Personal Finance Planner — Architecture (v1)
status: validated
updated: 2026-09-24
---

# Personal Finance Planner — Design Document (v1)

Single-user, offline-first, local-first SPA. Mobile-first for iPhone 16 Pro Safari, with a lightweight responsive pass for regular laptop-browser use. Hosted as a static build on GitHub Pages. Local persistence now (Dexie/IndexedDB); Firestore is designed for, not built, in v1 — except the sync **shape** (outbox, cache metadata), which is worth laying down now since it touches the schema.

Sections marked **[ASSUMPTION]** are places I inferred beyond what you said — please confirm or correct those specifically.

---

## 1. Technology Selections

| Concern | Choice | Why |
|---|---|---|
| UI library | React 18 + TypeScript | Type safety across model/service/repository layers |
| Build tool | Vite | Fast, clean static output, trivial GitHub Pages `base` path config |
| State management | Zustand | Thin, no boilerplate, plays well with a service layer underneath |
| Styling | CSS Modules | One `.module.css` per component — zero styling logic in JSX |
| Local persistence | Dexie.js (IndexedDB) | Async, promise-based, good TS support |
| Cloud persistence | Firebase Firestore | Interface + outbox shape designed now; `FirestoreRepository` implementations come later |
| Sync boundary | Local Dexie writes synchronous; remote pushed via a persisted **outbox queue** | See §5 — no new library, just a Dexie table + a small `SyncService` |
| Routing | None — tab state in the UI store | 4 tabs + sheets; avoids GitHub Pages subpath/deep-link complexity |
| Charting (Annual Summary) | Minimal custom SVG bar chart **[ASSUMPTION — easy to swap]** | Keeps bundle small; swap for a library (e.g. recharts) later if you want richer interaction |
| Date handling | date-fns **[ASSUMPTION — easy to swap]** | Tree-shakeable |
| ID generation | nanoid **[ASSUMPTION — easy to swap]** | Small, collision-safe, offline-safe |
| Hosting/CI | GitHub Pages via GitHub Actions | Free, matches "low-cost git-like platform" |
| Testing | Vitest + React Testing Library **[ASSUMPTION, not elaborated below]** | Native Vite pairing, not load-bearing |

---

## 2. Domain Model

### 2.1 The planned-vs-actual rule

Every transaction carries two things that decide planned vs. actual:

- **`date`** — the operative date. Defaults to *today* at entry time unless changed. Drives month/year bucketing.
- **`statusKind`** — a fixed, code-level marker: `'planned' | 'actual'`. Structural — the dashboard's balance math and Upcoming/Completed split depend on it.

`statusLabelId` is a separate, user-customizable display label (Planned / Partial / Paid / anything you add) sourced from Master Data. It drives the pill text/color only, never the math.

### 2.2 Master Data — enumeration groups

Confirmed: the same `MetadataGroup` primitive is used two ways — as a **category** (the group itself is the selectable value), and as a **pure enumeration** (the group is a named bucket like "Payment Modes"/"Accounts"/"Status" whose *items* are the selectable values).

`key` is a **type discriminator**, not a unique id: every category-purpose group (Housing, Income, Essentials...) shares `key: 'category'` — there are many of them, distinguished by their own `id`/`name`. `'account'`, `'paymentMode'`, and `'status'` each have exactly **one** group with that key, since those are single well-known enumerations the app queries by key (e.g. "the payment-mode group"). `isSystem: true` marks a group whose *existence* the app depends on (`account`/`paymentMode`/`status` — the group itself can't be deleted, though its items can be freely edited); category groups are `isSystem: false` — fully user-manageable, add/remove at will.

```ts
interface MetadataGroup {
  id: string;
  key: string;          // 'category' (shared by many) | 'account' | 'paymentMode' | 'status' (one each)
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;     // true = app logic depends on this group existing (account/paymentMode/status)
  items: MetadataItem[];
  createdAt: string;
  updatedAt: string;
}

interface MetadataItem {
  id: string;
  label: string;
  order: number;
  archived: boolean;     // soft-delete so historical transactions don't dangle
}
```

### 2.3 Transaction

```ts
interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;          // → MetadataGroup.id
  date: string;                 // ISO date; auto = entry date unless changed
  statusKind: 'planned' | 'actual';
  statusLabelId?: string;       // → MetadataItem.id in the 'status' group (display only)
  accountId?: string;           // → MetadataItem.id in the 'account' group
  paymentModeId?: string;       // → MetadataItem.id in the 'paymentMode' group
  notes?: string;
  ruleId?: string;               // exact rule VERSION that spawned this
  ruleGroupId?: string;          // full rule LINEAGE — survives rule edits (see 2.4)
  monthKey: string;              // 'YYYY-MM', indexed
  year: number;                   // indexed
  createdAt: string;
  updatedAt: string;              // last-write-wins sync key
}
```

### 2.4 Recurring Rule — versioned, immutable

A rule is never updated in place. Every edit produces a new row. Two outcomes, depending on *what* changed:

- **New version, same lineage** — amount, schedule (`dayOfMonth`/cadence), or `status` changed. Gets the next `version` number, same `ruleGroupId`, `effectiveFrom` = the date you made the change (or a date you pick). The prior version's `effectiveTo` is set to that same date (exclusive) and `supersedesId` links back.
- **New lineage entirely** — **`name`, `categoryId`, or `type`** changed (confirmed). Gets a brand-new `ruleGroupId`, `version: 1`, no `supersedesId`. `description` changing alone is cosmetic — non-breaking, versions in place like amount/schedule. The old lineage's last version keeps its `effectiveTo` open — it simply stops being materialized once you pause/stop it, or coexists if you intend two related-but-distinct rules.

```ts
interface RecurringRule {
  id: string;                   // unique per version
  ruleGroupId: string;          // stable across versions in one lineage
  version: number;               // 1-based within the group
  effectiveFrom: string;         // ISO date — when this version starts applying
  effectiveTo?: string;          // ISO date, exclusive — set once superseded
  supersedesId?: string;         // previous version's id, same group

  name: string;                  // chain-breaking if changed
  description?: string;
  type: 'income' | 'expense';     // chain-breaking if changed
  categoryId: string;              // chain-breaking if changed ("tag")

  amount: number;                  // versions, doesn't break chain
  repeats: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth?: number;              // for 'monthly'
  dayOfWeek?: number;                // for 'weekly'
  monthOfYear?: number;               // for 'yearly', paired with dayOfMonth
  startDate: string;
  status: 'active' | 'paused' | 'stopped';   // versions, doesn't break chain

  createdAt: string;
  updatedAt: string;
}
```

`RuleRepository` exposes only `save` (always an insert of a new row) and reads — no update method exists, enforcing immutability at the interface level.

### 2.5 Rule execution → traceable transactions

On month select, `RuleEngineService.materializeMonth(year, month)` runs:

1. Group rules by `ruleGroupId`.
2. Per group, pick the version whose `[effectiveFrom, effectiveTo)` window covers the target month **and** whose `status === 'active'`.
3. If that version's schedule fires in this month, check whether a `Transaction` with that exact `ruleId` already exists for this `monthKey` (idempotency).
4. If missing, create one: `statusKind: 'planned'`, `ruleId` = that version's id, `ruleGroupId` set, `date` = the computed occurrence date.
5. Completing it later flips `statusKind` to `'actual'` and updates `statusLabelId` — `ruleId`/`ruleGroupId` are never cleared.

Because step 2 pins the *version active at that month*, editing a rule today never rewrites the amount on transactions already materialized for past months.

---

## 3. Folder Structure

```
src/
  app/                    # shell composition, tab switching
  components/             # dumb presentational primitives — Card, Pill, IconBadge,
                           # BottomSheet, FormField, ToggleGroup, ChipInput, Button,
                           # ScrollableList (shared scroll container)
  screens/
    Cashflow/              # MonthSelector, ProjectedBalanceCard, SummaryCard,
                            # TransactionSection (scrollable), TransactionRow
    Rules/                 # RuleSearchBar, RuleStatusFilterChips, RuleRow (scrollable list)
    MasterData/            # CategoryGrid, CategoryCard
    AnnualSummary/          # FiscalYearSelector, AnnualTotalsCard, MonthlyBreakdownChart,
                            # CategoryBreakdownList
    sheets/                 # TransactionFormSheet, RuleFormSheet, CategoryFormSheet
  stores/                  # Zustand: uiStore, transactionStore, ruleStore,
                            # metadataStore, annualSummaryStore
  services/                # TransactionService, RuleService, RuleEngineService,
                            # MetadataService, BalanceService, SyncService
  repositories/
    interfaces/             # TransactionRepository, RuleRepository, MetadataRepository
    dexie/                  # db.ts (schema), Dexie*Repository implementations,
                            # DexieSyncOutbox, DexieCacheMeta
    firestore/               # placeholder only — not implemented in v1
  models/                   # pure TS types, zero React/UI imports (2.2–2.4 above)
  utils/                    # date helpers, id gen, currency formatting
  index.css                 # design tokens (CSS variables for the PDF's palette)
```

---

## 4. Component Tree

```mermaid
graph TD
  App --> AppShell
  AppShell --> Header
  AppShell --> ActiveScreen
  AppShell --> BottomNav
  AppShell --> SheetHost

  ActiveScreen --> CashflowScreen
  ActiveScreen --> RulesScreen
  ActiveScreen --> MasterDataScreen
  ActiveScreen --> AnnualSummaryScreen

  CashflowScreen --> MonthSelector
  CashflowScreen --> ProjectedBalanceCard
  CashflowScreen --> SummaryCardRow
  CashflowScreen --> UpcomingSection
  CashflowScreen --> CompletedSection
  CashflowScreen --> FAB
  UpcomingSection --> ScrollableList1[ScrollableList]
  CompletedSection --> ScrollableList2[ScrollableList]
  ScrollableList1 --> TransactionRow
  ScrollableList2 --> TransactionRow

  RulesScreen --> RuleSearchBar
  RulesScreen --> RuleStatusFilterChips
  RulesScreen --> ScrollableList3[ScrollableList]
  ScrollableList3 --> RuleRow
  RulesScreen --> AddRuleButton

  MasterDataScreen --> TotalCategoriesCard
  MasterDataScreen --> CategoryGrid
  CategoryGrid --> CategoryCard
  MasterDataScreen --> AddCategoryButton

  AnnualSummaryScreen --> FiscalYearSelector
  AnnualSummaryScreen --> AnnualTotalsCard
  AnnualSummaryScreen --> MonthlyBreakdownChart
  AnnualSummaryScreen --> CategoryBreakdownList

  SheetHost --> TransactionFormSheet
  SheetHost --> RuleFormSheet
  SheetHost --> CategoryFormSheet
```

Shared primitives: `Card`, `Pill`, `IconBadge`, `BottomSheet`, `FormField`, `SelectField`, `ToggleGroup`, `ChipInput`, `IconPicker`, `ColorPicker`, `Button`, `ScrollableList`.

**Interaction rules:**
- Tapping the FAB, a `TransactionRow`, a `RuleRow`, or a `CategoryCard` sets `uiStore.activeSheet = { type, mode: 'create'|'edit', targetId }`. `SheetHost` renders the matching sheet.
- Screens/rows are **presentational + store-bound only** — never call services or repositories directly.
- Sheets submit to the relevant **Service**; the store's action wraps that call and updates local state on success.
- **`ScrollableList`** is a fixed-height, `overflow-y: auto` container wrapping `UpcomingSection`, `CompletedSection`, and the Rules list — so the page header and balance card stay pinned while long lists scroll independently. Plain scroll, not virtualized; revisit with `react-window` only if list sizes grow well beyond a typical month's/ruleset's item count.
- **`SummaryCard`** (Income/Expense, used on both Cashflow and Annual Summary): **Actual is the large/primary figure; Planned is the small subtext** — inverted from the source PDF per your instruction.

---

## 5. State → Service → Repository → Sync Flow

```mermaid
graph LR
  Screens["Screens & Sheets (React)"] --> Stores["Zustand Stores"]
  Stores --> Services["Service Layer"]
  Services --> LocalRepo["Local Repository (Dexie) — synchronous, awaited"]
  Services --> Outbox["syncOutbox (Dexie table) — event enqueued after local write"]
  Outbox --> SyncService["SyncService — background, drains FIFO, retry/backoff"]
  SyncService --> RemoteRepo["Remote Repository (Firestore) — async"]
```

- **Stores**: UI-bound state only (current month's data, loading/error, active tab/sheet). No persistence logic, no business rules.
- **Services**: own business logic — rule materialization (2.5), balance/aggregation math, validation. Depend only on repository **interfaces**.
- **Local write path is synchronous**: a Service calls `LocalRepository.save()`, awaits it, the store updates — the UI reflects the change immediately, online or offline.
- **Remote write path is queue-based**: on successful local write, the Service also appends an entry to `syncOutbox` (`{ entityType, entityId, op, payload, createdAt }`). A single background `SyncService` — not the repositories themselves — drains this queue FIFO and calls the matching `FirestoreRepository` method per entry, deleting the entry on success and retrying with backoff on failure (including "offline" as a retryable failure). This is the lighter of the two models you offered: repositories stay plain CRUD; only the genuinely unreliable boundary (network) is event/queue-driven.

```ts
interface TransactionRepository {
  getByMonth(year: number, month: number): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | undefined>;
  getByRuleId(ruleId: string): Promise<Transaction[]>;
  getByRuleGroupId(ruleGroupId: string): Promise<Transaction[]>;   // full lineage history
  save(tx: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
}
// RuleRepository (save = insert-only, see 2.4), MetadataRepository follow the same shape
```

---

## 6. Persistence

### 6.1 Dexie schema (v1)

```ts
db.version(1).stores({
  transactions: 'id, monthKey, year, ruleId, ruleGroupId, categoryId, statusKind, updatedAt',
  rules: 'id, ruleGroupId, status, categoryId, effectiveFrom, updatedAt',
  metadataGroups: 'id, key, updatedAt',
  syncOutbox: '++localSeq, entityType, entityId, op, createdAt',
  monthCacheMeta: 'monthKey, lastAccessedAt',
});
```

### 6.2 Firestore shape (future, not built in v1)

Each Dexie table maps 1:1 to a Firestore collection, document ID = same `id`. Every record carries `updatedAt`; sync uses **last-write-wins by `updatedAt`**.

### 6.3 Data lifecycle & cache eviction (future — Firestore era)

Firestore is the system of record; Dexie is a **working-set cache scoped to the current fiscal year (Apr–Mar)**, purely to bound local storage. Nothing is ever lost — eviction only ever removes data that is already durably in Firestore.

- **Retention rule**: local Dexie holds transactions for the current FY only — from that FY's April through whatever months have data (including months already ahead of "today," e.g. a Dec 2026 transaction materialized in Sep 2026 stays local, since it's within the same FY). Example: on 24 Sep 2026, Dexie holds Apr 2026 – Mar 2027 transaction data; nothing from FY2025-26 or earlier.
- **FY rollover**: the first time the app runs after the real-world date crosses into a new FY (e.g. 1 Apr 2027), a sweep purges every transaction whose `monthKey` falls outside the new current FY. Local storage then holds only Apr 2027 onward, starting the cycle again.
- **Navigating to a prior-FY month**: fetched from Firestore on demand and cached in Dexie for a smooth session (fast re-visits, works if you flip back and forth), but it's transient — the next FY-rollover sweep purges it again like any other out-of-FY data. It is never re-pushed to Firestore (it came from there).
- **Every write** goes through the outbox (§5) regardless of which FY it belongs to, so Firestore always converges even if the affected month gets evicted locally moments later.
- Rules and Master Data are **never evicted** — small, and needed globally for materialization/dropdowns regardless of which month or FY is open.
- `monthCacheMeta` (`monthKey, lastAccessedAt`) still exists mainly to know *which* months are currently cached (so the UI can decide "fetch from Firestore" vs "read local") — the sweep's actual trigger is the FY boundary, not `lastAccessedAt` age.

---

## 7. Annual Summary Screen (new — FY Apr–Mar)

Confirmed. Added as a 4th bottom-nav tab. Content, modeled on the Cashflow screen's visual language:

- **`FiscalYearSelector`** — `‹ FY 2026–27 ›`, April-to-March range.
- **`AnnualTotalsCard`** — actual income, actual expense, net savings for the FY-to-date (hero card, same treatment as `ProjectedBalanceCard`).
- **`MonthlyBreakdownChart`** — one bar (or paired income/expense bars) per month, Apr…Mar, actual amounts.
- **`CategoryBreakdownList`** — top categories by actual spend for the FY, reusing `TransactionRow`-style rows.

**Data layer**: `BalanceService.getAnnualSummary(fyStartYear)` aggregates 12 months of transactions. For a current-FY request, all months are already local. For a **prior-FY** request, months not cached locally are fetched from Firestore on demand (§6.3) and cached transiently for the session, then purged again on the next FY-rollover sweep like any other out-of-FY data.

---

## 8. Local Authentication & Encryption at Rest

Per your instruction: the local key both **gates** the app and **encrypts** the Dexie data, using an **alphanumeric passphrase**. Google-account login is a later phase, layered on top without disturbing this.

### 8.1 What's encrypted vs. what stays queryable

Dexie/IndexedDB can't query ciphertext, so encryption is **field-level**, not whole-record: fields the app needs to index or filter by stay in the clear; the sensitive payload is encrypted as one blob per record.

| Entity | Encrypted (`cipherPayload`) | Clear (stays indexed) |
|---|---|---|
| `Transaction` | `title`, `amount`, `notes` | `id`, `monthKey`, `year`, `categoryId`, `statusKind`, `ruleId`, `ruleGroupId`, `updatedAt` |
| `RecurringRule` | `name`, `amount`, `description` | `id`, `ruleGroupId`, `version`, `categoryId`, `status`, `effectiveFrom`, `updatedAt` |
| `MetadataGroup`/`MetadataItem` | — none | everything — no monetary figures, just labels |

**Trade-off, explicitly flagged**: anyone with direct IndexedDB access can still see *which categories* you transacted in, *when*, and *how many* transactions — but not titles, amounts, or notes. Full-record encryption would hide categories/dates too, but would also make month/status queries impossible without decrypting the entire table on every read. This is the standard practical middle ground for an encrypted local-first app; flag it if you want full-record encryption instead (bigger change: every list query becomes decrypt-then-filter in memory).

### 8.2 Key derivation & unlock flow

- **First run**: user sets a passphrase. Generate a random salt. Derive two independent values via PBKDF2-SHA256 (≥210,000 iterations, Web Crypto `SubtleCrypto`), never the passphrase itself is stored:
  - `verificationHash` — stored locally, used only to check a re-entered passphrase is correct.
  - `dataKey` — an AES-GCM 256 key, held **only in memory** for the session (module-level, not in Zustand/devtools-visible state), used by the repository decorators (8.3). Re-derived from the passphrase on every unlock; never persisted anywhere.
- **Every subsequent app open**: `UnlockScreen` prompts for the passphrase; `CryptoService` re-derives `verificationHash` and compares; on match, derives and holds `dataKey`, sets `authStore.isUnlocked = true`.
- **Accepted risk**: there is no recovery path in v1 — a lost passphrase means the locally encrypted data is unrecoverable (Firestore, once built, becomes the actual recovery path via re-sync after Google sign-in).

### 8.3 Where this lives in the architecture

Encryption is implemented as a **repository decorator**, so it's invisible above the repository layer — Services still just see a `TransactionRepository`/`RuleRepository` interface:

```
EncryptingTransactionRepository implements TransactionRepository
  wraps → DexieTransactionRepository
  save(tx):    split clear/sensitive fields → encrypt sensitive blob with dataKey → inner.save(record)
  getByMonth(): inner.getByMonth() → decrypt each record's cipherPayload → return full Transaction[]
```

```mermaid
graph LR
  Services --> EncRepo["EncryptingTransactionRepository"]
  EncRepo --> RawRepo["DexieTransactionRepository (raw CRUD)"]
  EncRepo -.uses.-> Crypto["CryptoService (holds session dataKey)"]
```

New pieces added to §3's folder structure:
- `services/CryptoService.ts` — key derivation, encrypt/decrypt primitives
- `services/AuthService.ts` — first-run setup, unlock/verify, lock
- `stores/authStore.ts` — `{ isUnlocked, hasPassphraseSet }` only — never the key itself
- `screens/Auth/UnlockScreen.tsx` — first-run "set passphrase" form / returning "enter passphrase" form
- `repositories/dexie/encrypting/` — `EncryptingTransactionRepository.ts`, `EncryptingRuleRepository.ts` (MetadataRepository stays unwrapped — nothing to encrypt)
- `App` renders `UnlockScreen` **or** `AppShell`, gated on `authStore.isUnlocked` — nothing else mounts until unlocked.

### 8.4 Dexie schema addition

```ts
db.version(1).stores({
  // ...existing tables (§6.1)...
  authConfig: 'id',   // single record: { id: 'default', salt, verificationHash }
});
```

### 8.5 Forward note — Google-account login (later phase)

Firebase Auth (Google Sign-In) will primarily gate the **Firestore sync boundary** — the resulting `uid` becomes the partition key for your cloud data (e.g. `/users/{uid}/transactions/{id}`), so Firestore security rules enforce it's only ever your own data. Whether the local passphrase lock stays as an *additional* defense-in-depth layer once Google auth exists, or is retired in favor of relying on device-level security + Firestore rules, is a decision for that phase — not blocking now, and nothing in §8.1–8.3 needs to change either way.

---

## 9. Open Questions

None outstanding.

1. ✅ Chain-breaking fields confirmed: `name`, `categoryId`, `type`. `description` alone is non-breaking.
2. ✅ Annual Summary layout confirmed as proposed.
3. ✅ No separate outbox-pruning concern — `syncOutbox` entries are deleted immediately on successful push (§5); eviction (§6.3) is entirely FY-boundary driven, not age-based.
4. ✅ Local login confirmed as gate + encrypt-at-rest, alphanumeric passphrase (§8).

---

*Design validated. Proceeding to scaffold.*
