/**
 * Services section with in-depth work grid
 */
import Container from '@/components/layout/Container';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Service {
  title: string;
  description: string;
  features: string[];
  isSpecialty?: boolean;
}

const services: Service[] = [
  {
    title: 'Paste Any Product Link',
    description: 'Works with Amazon, eBay, Etsy, and hundreds of other stores.',
    features: [
      'Auto-detects product details',
      'Extracts title, image, and price',
      'Smart fallback handling',
    ],
    isSpecialty: true,
  },
  {
    title: 'Instant Preview',
    description: 'See what you\'ll save before adding to your collection.',
    features: [
      'Live product preview',
      'Verify details',
      'Edit if needed',
    ],
  },
  {
    title: 'Your Collection',
    description: 'Organize and manage all your saved products in one place.',
    features: [
      'Beautiful grid layout',
      'Fast search and filter',
      'One-click removal',
    ],
  },
];

export default function Services() {
  return (
    <section id="services" className="py-16 md:py-20">
      <Container>
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service, idx) => (
            <Card
              key={idx}
              className={`relative ${service.isSpecialty ? 'ring-2 ring-brand-blue' : ''}`}
            >
              {service.isSpecialty && (
                <div className="absolute top-3 right-3">
                  <Badge variant="blue">Our specialty</Badge>
                </div>
              )}
              
              <h3 className="font-semibold text-xl mb-2">{service.title}</h3>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                {service.description}
              </p>
              
              <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                {service.features.map((feature, fIdx) => (
                  <li key={fIdx}>• {feature}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

