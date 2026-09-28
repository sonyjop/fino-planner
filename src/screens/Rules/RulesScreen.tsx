import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/Button';
import ScrollableList from '../../components/ScrollableList';
import { useRuleStore } from '../../stores/ruleStore';
import { useUiStore } from '../../stores/uiStore';
import styles from './RulesScreen.module.css';
import RuleRow from './RuleRow';
import RuleSearchBar from './RuleSearchBar';
import RuleStatusFilterChips, { type StatusFilter } from './RuleStatusFilterChips';

export default function RulesScreen() {
  const rules = useRuleStore((s) => s.rules);
  const load = useRuleStore((s) => s.load);
  const openSheet = useUiStore((s) => s.openSheet);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: rules.length,
      active: rules.filter((r) => r.status === 'active').length,
      paused: rules.filter((r) => r.status === 'paused').length,
      cancelled: rules.filter((r) => r.status === 'cancelled').length,
      expired: rules.filter((r) => r.status === 'expired').length,
    }),
    [rules],
  );

  const filtered = useMemo(() => {
    return rules
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [rules, statusFilter, search]);

  return (
    <div className={styles.screen}>
      <h1>Recurring Rules</h1>
      <p className={styles.subtitle}>Automate your monthly plan</p>

      <RuleSearchBar value={search} onChange={setSearch} />
      <RuleStatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={counts} />

      {filtered.length === 0 ? (
        <p className={styles.empty}>No rules match here yet.</p>
      ) : (
        <ScrollableList>
          {filtered.map((rule) => (
            <RuleRow key={rule.ruleGroupId} rule={rule} />
          ))}
        </ScrollableList>
      )}

      <Button className={styles.addButton} onClick={() => openSheet({ type: 'rule', mode: 'create' })}>
        + Add recurring rule
      </Button>
    </div>
  );
}
