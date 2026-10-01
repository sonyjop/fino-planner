- source_spec: `_bmad-output/implementation-artifacts/spec-master-data.md`
  summary: A completed rule occurrence whose date is edited into another month is double-counted — its origin month re-plans the occurrence and the target month loses its own.
  evidence: `mergeStoredWithVirtual` suppresses a virtual occurrence by `ruleGroupId` within the stored row's current month only (Cashflow `getForMonth` and `BalanceService.buildAnnualSummary`); pre-existing since the original rule engine. Fix by claiming on occurrence identity (lineage + original occurrence month).
- source_spec: `_bmad-output/implementation-artifacts/spec-master-data.md`
  summary: Transaction and rule forms pre-select the first sub-category (Housing › House Rent), so an untouched picker files the entry as rent.
  evidence: Both sheets seed `subCategoryId` from `pickableLeaves(...)[0].items[0]`; carried over from the old first-category default, riskier now with ~30 leaves. Starting empty with `required` would force a choice.
- source_spec: `_bmad-output/implementation-artifacts/spec-master-data.md`
  summary: No component tests pin the Cashflow summary cards (committed vs planned props) or the Annual Summary table columns.
  evidence: Verification-gap review: swapping `actual`/`planned` in `CashflowScreen` or the planned/committed cells in `CategoryBreakdownTable` passes the suite.
