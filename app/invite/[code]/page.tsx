'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Check, X, Users } from 'lucide-react';
import Link from 'next/link';

type PreviewOk = {
  canJoin: boolean;
  reason?: 'owner' | 'already_collaborator';
  collectionName: string;
  ownerDisplayName: string;
  ownerUsername: string;
};

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string) || '';

  const [status, setStatus] = useState<
    'loading' | 'login' | 'confirm' | 'joining' | 'success' | 'error'
  >('loading');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<PreviewOk | null>(null);

  const loadPreview = useCallback(async () => {
    if (!code) {
      setStatus('error');
      setMessage('Invalid invite link.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setStatus('login');
      setMessage('Sign in to join this collection.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(
        `/api/collections/invite/preview?code=${encodeURIComponent(code)}`,
        {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Could not load this invite.');
        return;
      }

      setPreview({
        canJoin: data.canJoin !== false,
        reason: data.reason,
        collectionName: data.collectionName || 'this collection',
        ownerDisplayName: data.ownerDisplayName || 'Someone',
        ownerUsername: data.ownerUsername || '',
      });
      setStatus('confirm');
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }, [code]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleDeny = () => {
    router.push('/dashboard');
  };

  const handleApprove = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStatus('login');
      return;
    }

    setStatus('joining');
    try {
      const res = await fetch('/api/collections/invite/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setMessage(`You've joined "${data.collectionName || 'the collection'}"!`);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to join collection.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-beige-50 dark:bg-dpurple-950 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-dpurple-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-dpurple-700 p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">Loading invite…</p>
          </>
        )}

        {status === 'joining' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">Joining collection…</p>
          </>
        )}

        {status === 'confirm' && preview && (
          <>
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            {preview.canJoin ? (
              <>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                  Join this collection?
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-1">
                  You are about to join{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {preview.ownerDisplayName}
                  </span>
                  {preview.ownerUsername ? (
                    <span className="text-zinc-500 dark:text-zinc-500">
                      {' '}
                      (@{preview.ownerUsername})
                    </span>
                  ) : null}
                  ’s collection{' '}
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    &ldquo;{preview.collectionName}&rdquo;
                  </span>
                  .
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-6">
                  You&apos;ll be able to collaborate on this collection as an editor.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={handleDeny}
                    className="flex-1 px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-dpurple-600 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-dpurple-800 transition-colors"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="flex-1 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {preview.reason === 'owner'
                    ? 'You own this collection'
                    : 'Already a collaborator'}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  {preview.reason === 'owner'
                    ? `You can't join your own list "${preview.collectionName}" via invite.`
                    : `You're already on "${preview.collectionName}".`}
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{message}</h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center mt-4 px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Could not continue</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{message}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-zinc-200 dark:bg-dpurple-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-300 dark:hover:bg-dpurple-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'login' && (
          <>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Sign in to join</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{message}</p>
            <Link
              href={`/login?redirect=/invite/${encodeURIComponent(code)}`}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
            >
              Sign In
            </Link>
            <p className="mt-3 text-xs text-zinc-400">
              Don&apos;t have an account?{' '}
              <Link href={`/signup?redirect=/invite/${encodeURIComponent(code)}`} className="text-violet-500 underline">
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
