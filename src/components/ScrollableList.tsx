import type { ReactNode } from 'react';
import styles from './ScrollableList.module.css';

interface ScrollableListProps {
  children: ReactNode;
}

/** Fixed-height, independently-scrolling container — architecture.md §4. */
export default function ScrollableList({ children }: ScrollableListProps) {
  return <div className={styles.list}>{children}</div>;
}
