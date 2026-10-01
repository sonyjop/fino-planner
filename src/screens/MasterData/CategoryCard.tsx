import IconBadge from '../../components/IconBadge';
import type { MetadataGroup } from '../../models/MetadataGroup';
import { useUiStore } from '../../stores/uiStore';
import styles from './CategoryCard.module.css';

export default function CategoryCard({ category }: { category: MetadataGroup }) {
  const openSheet = useUiStore((s) => s.openSheet);
  const activeCount = category.items.filter((i) => !i.archived).length;

  return (
    <button
      className={category.archived ? `${styles.card} ${styles.archived}` : styles.card}
      onClick={() => openSheet({ type: 'category', mode: 'edit', targetId: category.id })}
    >
      <IconBadge icon={category.icon} color={category.color} />
      <span className={styles.name}>{category.name}</span>
      <span className={styles.meta}>
        {category.archived ? 'Archived' : `${activeCount} sub-categor${activeCount === 1 ? 'y' : 'ies'}`}
      </span>
    </button>
  );
}
