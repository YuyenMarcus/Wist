/**
 * Featured Work section with Bento grid and live preview
 */
import { useState } from 'react';
import Container from '@/components/layout/Container';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  features: string[];
  url: string;
  previewUrl?: string;
}

const projects: Project[] = [
  {
    id: '1',
    title: 'Wist Collections',
    description: 'Modern e-commerce automation platform.',
    category: 'Creative / Retail',
    features: ['Product sync automation', 'Smart pricing rules'],
    url: '#',
  },
  {
    id: '2',
    title: 'Product Scraper',
    description: 'Reliable product data extraction system.',
    category: 'Automation',
    features: ['Structured data parsing', 'Multi-source support'],
    url: '#',
  },
];

export default function FeaturedWork() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <section className="py-16 md:py-20 bg-[var(--color-bg-secondary)]">
      <Container>
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
          Featured Work
        </h2>
        
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {/* Left: 2x2 card grid */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                hover
                className="cursor-pointer"
                onClick={() => setSelectedProject(project)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-pink-500" />
                  <Badge variant="blue">{project.category}</Badge>
                </div>
                
                <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-3">
                  {project.description}
                </p>
                
                <ul className="text-sm space-y-1 mb-3">
                  {project.features.map((feature, idx) => (
                    <li key={idx} className="text-[var(--color-text-secondary)]">
                      • {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="flex justify-between items-center text-sm mt-4 pt-3 border-t border-[var(--color-border)]">
                  <a
                    href={project.url}
                    className="text-pink-500 hover:text-pink-600 transition-colors"
                  >
                    View Live Site →
                  </a>
                  <span className="text-[var(--color-text-muted)]">Click to preview</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Right: Preview panel */}
          <div className="h-[400px] md:h-[600px]">
            <Card className="h-full">
              <div className="h-full bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden">
                {selectedProject ? (
                  <iframe
                    src={selectedProject.previewUrl || selectedProject.url}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts"
                    title={`Preview: ${selectedProject.title}`}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">
                    <p>Hover over a project to preview</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </section>
  );
}

