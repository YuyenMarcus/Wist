/**
 * Custom 404 page
 */
import Head from 'next/head';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Wist Collections</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <Container>
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-brand-blue to-brand-light bg-clip-text text-transparent">
              404
            </h1>
            <p className="text-xl text-[var(--color-text-secondary)] mb-8">
              Page not found
            </p>
            <Button variant="primary" onClick={() => window.location.href = '/'}>
              Go Home
            </Button>
          </div>
        </Container>
      </div>
    </>
  );
}

