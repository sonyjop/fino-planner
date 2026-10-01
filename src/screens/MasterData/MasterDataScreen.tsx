import { useEffect, useState } from 'react';
import { useMetadataStore } from '../../stores/metadataStore';
import { groupsByKey } from '../../utils/metadata';
import CategoryGrid from './CategoryGrid';
import styles from './MasterDataScreen.module.css';
import PaymentModeList from './PaymentModeList';
import TotalCategoriesCard from './TotalCategoriesCard';

export default function MasterDataScreen() {
  const groups = useMetadataStore((s) => s.groups);
  const refresh = useMetadataStore((s) => s.refresh);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    // Usage stamps (firstUsedAt) change when transactions/rules are saved elsewhere — re-read
    // so "Remove" offers archive vs. delete correctly.
    refresh();
  }, [refresh]);

  const categories = groupsByKey(groups, 'category');
  const paymentModes = groupsByKey(groups, 'paymentMode');

  return (
    <div className={styles.screen}>
      <h1>Master Data</h1>
      <p className={styles.subtitle}>Categories and how you pay</p>

      <TotalCategoriesCard count={categories.filter((g) => !g.archived).length} />

      <label className={styles.archivedToggle}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      <CategoryGrid categories={categories} showArchived={showArchived} />
      <PaymentModeList paymentModes={paymentModes} showArchived={showArchived} />
    </div>
  );
}
