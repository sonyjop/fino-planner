import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillTone = 'planned' | 'partial' | 'paid' | 'active' | 'paused' | 'stopped' | 'neutral';

interface PillProps {
  tone: PillTone;
  children: ReactNode;
}

export default function Pill({ tone, children }: PillProps) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>;
}
