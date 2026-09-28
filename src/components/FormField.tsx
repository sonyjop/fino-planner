import type { ReactNode } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  children: ReactNode;
}

/**
 * Label + control wrapper. Controls (input/select/textarea) share the `.input` look by
 * importing FormField.module.css directly — see any usage for the pattern.
 */
export default function FormField({ label, children }: FormFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
