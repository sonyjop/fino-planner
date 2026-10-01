import SelectField from './SelectField';

export interface GroupedOption {
  label: string;
  options: { value: string; label: string }[];
}

interface GroupedSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  groups: GroupedOption[];
  /** Shown as the empty choice — disabled when `required`, selectable (meaning "none") otherwise. */
  placeholder: string;
  required?: boolean;
  'aria-label'?: string;
}

/** A native select with one <optgroup> per parent — the leaf pickers for sub-categories and instruments. */
export default function GroupedSelectField({
  value,
  onChange,
  groups,
  placeholder,
  required = false,
  'aria-label': ariaLabel,
}: GroupedSelectFieldProps) {
  return (
    <SelectField value={value} onChange={(e) => onChange(e.target.value)} required={required} aria-label={ariaLabel}>
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
