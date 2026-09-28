import styles from './ToggleGroup.module.css';

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function ToggleGroup<T extends string>({ options, value, onChange }: ToggleGroupProps<T>) {
  return (
    <div className={styles.group}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? styles.optionActive : styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
