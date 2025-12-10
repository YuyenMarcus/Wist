/**
 * Homepage with new design system
 */
import Head from 'next/head';
import NavBar from '@/components/layout/NavBar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ProductCollection from '@/components/sections/ProductCollection';
import Services from '@/components/sections/Services';
import Marquee from '@/components/sections/Marquee';

export default function Home() {
  return (
    <>
      <Head>
        <title>Wist Collections - Product Wishlist Manager</title>
        <meta name="description" content="Save and manage your favorite products from Amazon, eBay, Etsy, and more" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1">
          <Hero />
          <ProductCollection />
          <Services />
          <Marquee />
        </main>
        <Footer />
      </div>
    </>
  );
}
