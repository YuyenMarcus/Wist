/**
 * Navigation bar component
 */
import Link from 'next/link';
import Container from './Container';
import ThemeToggle from './ThemeToggle';

export default function NavBar() {
  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-card)] backdrop-blur-md sticky top-0 z-50">
      <Container>
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-brand-blue to-brand-light bg-clip-text text-transparent">
            Wist
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
              Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </nav>
  );
}

