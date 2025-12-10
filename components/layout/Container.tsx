/**
 * Container component for consistent max-width and padding
 */
import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`max-w-[1200px] mx-auto px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}

