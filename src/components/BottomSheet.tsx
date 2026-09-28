import type { MouseEvent, ReactNode } from 'react';
import Icon from './Icon';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
