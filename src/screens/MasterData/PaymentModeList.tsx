import Icon from '../../components/Icon';
import IconBadge from '../../components/IconBadge';
import type { MetadataGroup } from '../../models/MetadataGroup';
import { useUiStore } from '../../stores/uiStore';
import { formatInstrument } from '../../utils/metadata';
import styles from './PaymentModeList.module.css';

interface PaymentModeListProps {
  paymentModes: MetadataGroup[];
  showArchived: boolean;
}

/** The six modes are fixed (no add/rename/archive); only their instruments are managed here. */
export default function PaymentModeList({ paymentModes, showArchived }: PaymentModeListProps) {
  const openSheet = useUiStore((s) => s.openSheet);

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Payment</h2>
      {paymentModes.map((mode) => {
        const instruments = mode.items
          .filter((i) => showArchived || !i.archived)
          .sort((a, b) => a.order - b.order);
        return (
          <div key={mode.id} className={styles.mode}>
            <div className={styles.modeHeader}>
              <IconBadge icon={mode.icon} color={mode.color} />
              <span className={styles.modeName}>{mode.name}</span>
              <button
                className={styles.addButton}
                onClick={() => openSheet({ type: 'instrument', mode: 'create', parentId: mode.id })}
                aria-label={`Add instrument to ${mode.name}`}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
            {instruments.length > 0 && (
              <ul className={styles.instruments}>
                {instruments.map((item) => (
                  <li key={item.id}>
                    <button
                      className={item.archived ? `${styles.instrument} ${styles.archived}` : styles.instrument}
                      onClick={() => openSheet({ type: 'instrument', mode: 'edit', targetId: item.id })}
                    >
                      {formatInstrument(item)}
                      {item.archived && <span className={styles.archivedTag}>Archived</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
