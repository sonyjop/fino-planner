import CategoryFormSheet from '../screens/sheets/CategoryFormSheet';
import InstrumentFormSheet from '../screens/sheets/InstrumentFormSheet';
import RuleFormSheet from '../screens/sheets/RuleFormSheet';
import TransactionFormSheet from '../screens/sheets/TransactionFormSheet';
import { useUiStore } from '../stores/uiStore';

export default function SheetHost() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  if (!activeSheet) return null;

  switch (activeSheet.type) {
    case 'transaction':
      return <TransactionFormSheet />;
    case 'rule':
      return <RuleFormSheet />;
    case 'category':
      return <CategoryFormSheet />;
    case 'instrument':
      return <InstrumentFormSheet />;
    default:
      return null;
  }
}
