import { formatCompactCurrency, formatCurrency } from '../../utils/currency';
import styles from './Amount.module.css';

interface AmountProps {
  value: number;
  compact?: boolean;
  /** Net figures: a negative value is shown with its minus sign in the expense colour. */
  signed?: boolean;
}

export default function Amount({ value, compact = false, signed = false }: AmountProps) {
  const text = compact ? formatCompactCurrency(value) : formatCurrency(value);
  const className = signed && value < 0 ? styles.negative : undefined;
  return <span className={className}>{text}</span>;
}
