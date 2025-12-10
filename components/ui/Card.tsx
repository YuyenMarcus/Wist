/**
 * Card component with consistent styling
 */
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', hover = true, onClick }: CardProps) {
  const baseStyles = 'p-6 md:p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm';
  
  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        className={`${baseStyles} ${onClick ? 'cursor-pointer' : ''} hover:shadow-lg transition-shadow ${className}`}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div 
      className={`${baseStyles} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

