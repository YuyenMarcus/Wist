/**
 * Navigation bar component
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import Container from './Container';
import ThemeToggle from './ThemeToggle';

export default function NavBar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    window.location.reload();
  };

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
            
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link 
                      href="/account" 
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                    >
                      Account
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link 
                    href="/login" 
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Login
                  </Link>
                )}
              </>
            )}
            
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </nav>
  );
}

