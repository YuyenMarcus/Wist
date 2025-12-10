/**
 * Design system constants
 * Colors, gradients, spacing, etc.
 */

export const COLORS = {
  brand: {
    blue: '#8b5cf6', // Purple/Violet - luxury, aspiration
    light: '#c4b5fd', // Lavender - dreamy, magical
    pink: '#fb7185', // Peach/Coral accent - warmth
  },
} as const;

export const GRADIENTS = {
  brand: 'from-violet-500 to-violet-400',
  pink: 'from-rose-400 to-rose-300',
  blueToLight: 'from-brand-blue to-brand-light',
} as const;

export const SPACING = {
  container: {
    maxWidth: '1200px',
    padding: {
      mobile: '1.5rem',
      desktop: '2.5rem',
    },
  },
  section: {
    vertical: {
      mobile: '4rem',
      desktop: '5rem',
    },
  },
  grid: {
    gap: {
      mobile: '1.5rem',
      desktop: '2rem',
    },
  },
} as const;

export const ROLES: string[] = [
  'Automation',
  'AI Tools',
  'Creative Retail',
  'E-commerce',
  'Product Scraping',
  'Wishlist Manager',
];

