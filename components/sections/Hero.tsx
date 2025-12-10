/**
 * Hero section with gradient headline and rotating text
 */
import { motion } from 'framer-motion';
import Container from '@/components/layout/Container';
import TextRotator from '@/components/motion/TextRotator';
import CardSwap from '@/components/motion/CardSwap';
import Button from '@/components/ui/Button';

export default function Hero() {
  return (
    <section className="relative py-16 md:py-20 overflow-hidden">
      {/* Background gradient pulses */}
      <div className="absolute inset-0 bg-gradient-radial opacity-40 blur-3xl pointer-events-none" />
      
      <Container>
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-brand-blue to-brand-light bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Wist Collections
            </motion.h1>
            
            <motion.p
              className="text-lg text-[var(--color-text-muted)] mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Add your favorite products — from anywhere.
              <br />
              <span className="text-base">Works with{' '}
                <TextRotator />
              </span>
            </motion.p>

            <motion.div
              className="flex gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Button 
                variant="primary"
                onClick={() => {
                  document.getElementById('product-collection')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Start Collecting
              </Button>
              <Button 
                variant="secondary"
                onClick={() => {
                  document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                How It Works
              </Button>
            </motion.div>
          </motion.div>

          {/* Right: 3D card stack */}
          <motion.div
            className="relative h-[400px] md:h-[500px]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <CardSwap
              cards={[
                {
                  id: '1',
                  title: 'Product Scraping',
                  description: 'Reliable data extraction',
                },
                {
                  id: '2',
                  title: 'Wishlist Management',
                  description: 'Organize your favorites',
                },
                {
                  id: '3',
                  title: 'Automation',
                  description: 'Streamline workflows',
                },
              ]}
            />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

