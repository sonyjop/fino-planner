import { useState } from 'react';
import styles from './AppShell.module.css';

type Tab = 'cashflow' | 'rules' | 'masterData' | 'annualSummary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'rules', label: 'Rules' },
  { id: 'masterData', label: 'Master Data' },
  { id: 'annualSummary', label: 'Summary' },
];

// Placeholder shell — real screens (Cashflow/Rules/MasterData/AnnualSummary) land in Phase 2.
export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('cashflow');

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <p className={styles.placeholder}>
          {TABS.find((t) => t.id === activeTab)?.label} screen — built in Phase 2.
        </p>
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
    </div>
  );
}
