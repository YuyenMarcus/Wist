/**
 * Marquee component for auto-scrolling company logos
 */
import { motion } from 'framer-motion';
import Container from '@/components/layout/Container';

const companies = [
  'Amazon',
  'BestBuy',
  'Target',
  'Walmart',
  'eBay',
  'Etsy',
  'Shopify',
  'Cascadia',
];

export default function Marquee() {
  return (
    <section className="py-16 md:py-20 bg-[var(--color-bg-secondary)]">
      <Container>
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          Works with
        </h2>
        
        <div className="relative overflow-hidden">
          <motion.div
            className="flex gap-8"
            animate={{
              x: [0, -50 * companies.length * 2],
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: 'loop',
                duration: 20,
                ease: 'linear',
              },
            }}
          >
            {/* Duplicate for seamless loop */}
            {[...companies, ...companies, ...companies].map((company, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 px-6 py-4 rounded-lg backdrop-blur-md bg-white/10 border border-[var(--color-border)] min-w-[150px] text-center"
              >
                <span className="text-[var(--color-text-secondary)] font-medium">
                  {company}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

