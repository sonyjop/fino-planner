import Icon from '../../components/Icon';
import type { MetadataGroup } from '../../models/MetadataGroup';
import { useUiStore } from '../../stores/uiStore';
import CategoryCard from './CategoryCard';
import styles from './CategoryGrid.module.css';

interface CategoryGridProps {
  categories: MetadataGroup[];
  showArchived: boolean;
}

export default function CategoryGrid({ categories, showArchived }: CategoryGridProps) {
  const openSheet = useUiStore((s) => s.openSheet);
  const visible = categories.filter((g) => showArchived || !g.archived);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Categories</h2>
        <button
          className={styles.addButton}
          onClick={() => openSheet({ type: 'category', mode: 'create' })}
          aria-label="Add category"
        >
          <Icon name="plus" size={18} /> Add
        </button>
      </div>
      <div className={styles.grid}>
        {visible.map((group) => (
          <CategoryCard key={group.id} category={group} />
        ))}
      </div>
    </section>
  );
}
