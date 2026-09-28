import Icon from '../../components/Icon';
import styles from './RuleSearchBar.module.css';

interface RuleSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function RuleSearchBar({ value, onChange }: RuleSearchBarProps) {
  return (
    <div className={styles.bar}>
      <Icon name="search" size={16} />
      <input
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search rules"
      />
    </div>
  );
}
