import { useEffect } from 'react';
import AnnualSummaryScreen from '../screens/AnnualSummary/AnnualSummaryScreen';
import CashflowScreen from '../screens/Cashflow/CashflowScreen';
import MasterDataScreen from '../screens/MasterData/MasterDataScreen';
import RulesScreen from '../screens/Rules/RulesScreen';
import { useMetadataStore } from '../stores/metadataStore';
import { useUiStore, type AppTab } from '../stores/uiStore';
import styles from './AppShell.module.css';
import SheetHost from './SheetHost';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'rules', label: 'Rules' },
  { id: 'masterData', label: 'Master Data' },
  { id: 'annualSummary', label: 'Summary' },
];

export default function AppShell() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const loadMetadata = useMetadataStore((s) => s.load);

  useEffect(() => {
    loadMetadata(); // seeds Master Data on first run, no-op afterward
  }, [loadMetadata]);

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        {activeTab === 'cashflow' && <CashflowScreen />}
        {activeTab === 'rules' && <RulesScreen />}
        {activeTab === 'annualSummary' && <AnnualSummaryScreen />}
        {activeTab === 'masterData' && <MasterDataScreen />}
      </main>

      <nav className={styles.bottomNav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <SheetHost />
    </div>
  );
}
