import type { SelectHTMLAttributes } from 'react';
import styles from './SelectField.module.css';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function SelectField(props: SelectFieldProps) {
  return <select {...props} className={styles.select} />;
}
