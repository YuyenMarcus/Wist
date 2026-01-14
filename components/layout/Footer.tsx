/**
 * Footer component
 */
import Container from './Container';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12">
      <Container>
        <div className="text-center">
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            Data fetched from source — prices may change.
          </p>
          <div className="flex justify-center gap-6 text-sm mb-6">
            <a href="/affiliate-disclosure" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Affiliate Disclosure
            </a>
            <a href="/terms" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Terms
            </a>
            <a href="/privacy" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Privacy
            </a>
          </div>
          <p className="text-[var(--color-text-muted)] text-xs">
            © 2026 Wist Inc. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

