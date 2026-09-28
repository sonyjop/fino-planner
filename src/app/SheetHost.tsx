import RuleFormSheet from '../screens/sheets/RuleFormSheet';
import TransactionFormSheet from '../screens/sheets/TransactionFormSheet';
import { useUiStore } from '../stores/uiStore';

// CategoryFormSheet lands when the Master Data screen is built.
export default function SheetHost() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  if (!activeSheet) return null;

  switch (activeSheet.type) {
    case 'transaction':
      return <TransactionFormSheet />;
    case 'rule':
      return <RuleFormSheet />;
    default:
      return null;
  }
}
