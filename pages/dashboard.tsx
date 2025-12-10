/**
 * Dashboard page - Main product collection interface
 */
import Head from 'next/head';
import Dashboard from '@/components/products/Dashboard';

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Dashboard - Wist Collections</title>
        <meta name="description" content="Collect and manage your favorite products" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Dashboard />
    </>
  );
}

