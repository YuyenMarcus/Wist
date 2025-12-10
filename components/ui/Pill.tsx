/**
 * Pill component for tech stacks and tags
 */
import { ReactNode } from 'react';

interface PillProps {
  children: ReactNode;
  className?: string;
}

export default function Pill({ children, className = '' }: PillProps) {
  return (
    <span className={`inline-block px-3 py-1 text-xs rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] ${className}`}>
      {children}
    </span>
  );
}

