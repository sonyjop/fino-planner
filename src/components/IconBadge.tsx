import Icon from './Icon';
import styles from './IconBadge.module.css';

interface IconBadgeProps {
  icon: string;
  color: string;
}

export default function IconBadge({ icon, color }: IconBadgeProps) {
  return (
    <div className={styles.badge} style={{ background: `${color}1f`, color }}>
      <Icon name={icon} />
    </div>
  );
}
