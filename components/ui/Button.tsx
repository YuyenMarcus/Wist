/**
 * Button component with variants
 */
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
};

export default function Button({ 
  variant = 'primary', 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'px-6 py-3 rounded-lg font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue';
  
  const variants = {
    primary: 'bg-brand-blue text-white hover:bg-violet-600 hover:shadow-lg',
    secondary: 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]',
    ghost: 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

