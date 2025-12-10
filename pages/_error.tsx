/**
 * Custom error page for Next.js
 */
import { NextPageContext } from 'next';
import Head from 'next/head';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';

interface ErrorProps {
  statusCode: number;
  hasGetInitialPropsRun?: boolean;
  err?: Error;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <>
      <Head>
        <title>Error {statusCode} - Wist Collections</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <Container>
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-brand-blue to-brand-light bg-clip-text text-transparent">
              {statusCode || 'Error'}
            </h1>
            <p className="text-xl text-[var(--color-text-secondary)] mb-8">
              {statusCode === 404
                ? "Page not found"
                : statusCode === 500
                ? "Internal server error"
                : "Something went wrong"}
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

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404;
  return { statusCode };
};

export default Error;

