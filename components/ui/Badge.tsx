/**
 * Badge component for labels and tags
 */
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'blue' | 'pink';
  className?: string;
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

