import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

type CardProps = HTMLAttributes<HTMLDivElement>;

export default function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card} {...rest}>
      {children}
    </div>
  );
}
