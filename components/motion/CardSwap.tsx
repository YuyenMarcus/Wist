/**
 * CardSwap component for 3D card stack animation
 * Simplified version using Framer Motion (GSAP optional)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';

interface CardData {
  id: string;
  title: string;
  description: string;
  image?: string;
}

interface CardSwapProps {
  cards: CardData[];
}

export default function CardSwap({ cards }: CardSwapProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  return (
    <div className="relative h-[400px] md:h-[500px] perspective-1000">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, rotateY: -15, scale: 0.95 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          exit={{ opacity: 0, rotateY: 15, scale: 0.95 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0 transform-style-3d"
          onClick={nextCard}
          style={{ cursor: 'pointer' }}
        >
          <Card className="h-full">
            <div className="h-full flex flex-col items-center justify-center p-8">
              {currentCard.image ? (
                <img
                  src={currentCard.image}
                  alt={currentCard.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-pink-500/20 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-[var(--color-text-muted)]">Card {currentIndex + 1}</span>
                </div>
              )}
              <h3 className="text-xl font-semibold mb-2">{currentCard.title}</h3>
              <p className="text-[var(--color-text-muted)] text-center">
                {currentCard.description}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-4">
                Click to swap
              </p>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

