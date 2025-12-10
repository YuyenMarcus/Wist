/**
 * Text rotator component for rotating role text
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLES } from '@/lib/constants';

interface TextRotatorProps {
  roles?: string[];
  interval?: number;
}

export default function TextRotator({ roles = ROLES, interval = 3000 }: TextRotatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % roles.length);
    }, interval);

    return () => clearInterval(timer);
  }, [roles.length, interval]);

  return (
    <span className="inline-block min-w-[200px] text-left">
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="inline-block"
        >
          {roles[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

