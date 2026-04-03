'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

function formatStripeMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

type PlanChangePreviewPayload = {
  amountDue: number;
  currency: string;
  subtotal: number;
  total: number;
  lineItems: Array<{
    description: string | null;
    amount: number;
    currency: string;
    proration: boolean;
    quantity: number;
  }>;
};

type PlanChangeFlowState = {
  target: 'pro' | 'creator';
  loading: boolean;
  error: string | null;
  preview: PlanChangePreviewPayload | null;
};
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
  Shield,
  Zap,
  Diamond,
  Crown,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getProfile, type Profile } from '@/lib/supabase/profile';
import { TIERS, type SubscriptionTier } from '@/lib/constants/subscription-tiers';
import TierBadge from '@/components/ui/TierBadge';
import LavenderLoader from '@/components/ui/LavenderLoader';
import PageTransition from '@/components/ui/PageTransition';
import { useTranslation } from '@/lib/i18n/context';

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<'pro' | 'creator' | null>(null);
  const [switchLoading, setSwitchLoading] = useState<'pro' | 'creator' | null>(null);
  const [planChangeFlow, setPlanChangeFlow] = useState<PlanChangeFlowState | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  /** Card brand / last4 from Stripe (server-resolved for logged-in customer). */
  const [pmSummary, setPmSummary] = useState<
    | undefined
    | 'loading'
    | 'none'
    | { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null }
  >(undefined);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login?redirect=/dashboard/subscription');
      return;
    }
    const { data, error } = await getProfile(user.id);
    if (error) {
      setMessage({ type: 'err', text: error.message || 'Failed to load profile' });
      setProfile(null);
    } else {
      setProfile(data);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const customerId = profile?.stripe_customer_id;
    const isEnt = profile?.subscription_tier === 'enterprise';
    if (!customerId || isEnt) {
      setPmSummary(undefined);
      return;
    }
    let cancelled = false;
    setPmSummary('loading');
    (async () => {
      try {
        const res = await fetch('/api/stripe/payment-method');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPmSummary('none');
          return;
        }
        if (!data.paymentMethod?.last4) {
          setPmSummary('none');
          return;
        }
        setPmSummary({
          brand: data.paymentMethod.brand ?? null,
          last4: data.paymentMethod.last4 ?? null,
          expMonth: data.paymentMethod.expMonth ?? null,
          expYear: data.paymentMethod.expYear ?? null,
        });
      } catch {
        if (!cancelled) setPmSummary('none');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.stripe_customer_id, profile?.subscription_tier]);

  useEffect(() => {
    const checkout = searchParams?.get('checkout');
    const sessionId = searchParams?.get('session_id');
    if (checkout !== 'success' || !sessionId?.startsWith('cs_')) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        if (!cancelled) {
          setMessage({ type: 'ok', text: t('Your subscription is active. Thank you!') });
          await load();
          router.replace('/dashboard/subscription');
        }
      } catch (e) {
        if (!cancelled) {
          setMessage({
            type: 'err',
            text: e instanceof Error ? e.message : t('Could not confirm checkout'),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, load, router, t]);

  const startCheckout = async (tier: 'pro' | 'creator') => {
    setCheckoutLoading(tier);
    setMessage(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(' ');
        throw new Error(msg || 'Checkout failed');
      }
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Checkout failed' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const runSwitchPlan = useCallback(
    async (target: 'pro' | 'creator'): Promise<boolean> => {
      setSwitchLoading(target);
      setMessage(null);
      try {
        const res = await fetch('/api/stripe/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: target }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = [data.error, data.hint].filter(Boolean).join(' ');
          throw new Error(msg || 'Could not update plan');
        }
        setMessage({ type: 'ok', text: t('Your plan was updated.') });
        await load();
        return true;
      } catch (e) {
        setMessage({
          type: 'err',
          text: e instanceof Error ? e.message : t('Could not update plan'),
        });
        return false;
      } finally {
        setSwitchLoading(null);
      }
    },
    [load, t]
  );

  const beginPlanChangeWithPreview = useCallback(
    async (target: 'pro' | 'creator') => {
      setPlanChangeFlow({ target, loading: true, error: null, preview: null });
      try {
        const res = await fetch('/api/stripe/preview-subscription-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: target }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = [data.error, data.hint].filter(Boolean).join(' ');
          throw new Error(msg || t('Could not load price preview'));
        }
        setPlanChangeFlow({
          target,
          loading: false,
          error: null,
          preview: data.preview as PlanChangePreviewPayload,
        });
      } catch (e) {
        setPlanChangeFlow({
          target,
          loading: false,
          error: e instanceof Error ? e.message : t('Could not load price preview'),
          preview: null,
        });
      }
    },
    [t]
  );

  const closePlanChangeFlow = useCallback(() => setPlanChangeFlow(null), []);

  useEffect(() => {
    if (!planChangeFlow || switchLoading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlanChangeFlow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [planChangeFlow, switchLoading, closePlanChangeFlow]);

  const confirmPlanChangeFromPreview = useCallback(async () => {
    if (!planChangeFlow) return;
    const target = planChangeFlow.target;
    const ok = await runSwitchPlan(target);
    if (ok) closePlanChangeFlow();
  }, [planChangeFlow, runSwitchPlan, closePlanChangeFlow]);

  const openPortal = async () => {
    setPortalLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal');
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      throw new Error('No portal URL returned');
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Portal failed' });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-beige-50 dark:bg-dpurple-950">
        <LavenderLoader />
      </div>
    );
  }

  const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
  const current = TIERS[tier];
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const hasStripeSubscription = Boolean(profile?.stripe_subscription_id);
  const isEnterprise = tier === 'enterprise';

  return (
    <PageTransition className="min-h-screen bg-beige-50 dark:bg-dpurple-950 pb-28 md:pb-16">
      {/* Standalone header (no dashboard sidebar on this route) */}
      <header className="sticky top-0 z-30 border-b border-beige-200 dark:border-dpurple-700 bg-beige-50/90 dark:bg-dpurple-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-w-0 text-zinc-900 dark:text-zinc-100 hover:opacity-90 transition-opacity"
          >
            <Image src="/logo.png" alt="Wist" width={32} height={32} className="w-8 h-8 shrink-0 dark:hidden" />
            <Image
              src="/white_logo.png"
              alt="Wist"
              width={32}
              height={32}
              className="w-8 h-8 shrink-0 hidden dark:block"
            />
            <span className="font-semibold text-sm truncate">Wist</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('Back to dashboard')}</span>
            <span className="sm:hidden">{t('Back')}</span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-violet-200/80 dark:border-violet-900/40 bg-gradient-to-br from-violet-50 via-beige-100 to-purple-50/90 dark:from-violet-950/50 dark:via-dpurple-900 dark:to-purple-950/30 shadow-sm mb-8 md:mb-10">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/20 dark:bg-violet-500/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-400/15 dark:bg-purple-500/10 blur-3xl"
            aria-hidden
          />
          <div className="relative p-6 md:p-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 dark:border-violet-800/60 bg-white/60 dark:bg-dpurple-950/60 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-4">
                <Zap className="w-3.5 h-3.5" aria-hidden />
                {t('Wist membership')}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                {t('Subscription & billing')}
              </h1>
              <p className="mt-2 text-sm md:text-base text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                {t('Upgrade for unlimited items, faster price checks, and more.')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-end gap-4 lg:min-w-[260px]">
              <div className="rounded-2xl border border-zinc-200/80 dark:border-dpurple-600 bg-white/90 dark:bg-dpurple-900/80 backdrop-blur-sm px-5 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                  {t('Current plan')}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {t(current.displayName)}
                  </span>
                  <TierBadge tier={tier} size="md" />
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {current.priceLabel}
                  {current.itemLimit == null
                    ? ` · ${t('Unlimited item cap')}`
                    : ` · ${t('Up to {n} items').replace('{n}', String(current.itemLimit))}`}
                </p>

                {!isEnterprise && hasStripeCustomer && (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 px-4 shadow-sm transition-colors disabled:opacity-60"
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4" />
                    )}
                    {t('Change subscription')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {searchParams?.get('checkout') === 'cancel' && (
          <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/25 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 shrink-0 opacity-80" />
            <span>{t('Checkout was canceled. No charges were made.')}</span>
          </div>
        )}

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 ${
              message.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:border-emerald-800 dark:text-emerald-100'
                : 'border-red-200 bg-red-50 text-red-900 dark:bg-red-950/35 dark:border-red-900/40 dark:text-red-200'
            }`}
          >
            {message.type === 'ok' ? (
              <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {isEnterprise && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/90 dark:bg-emerald-950/20 p-6 md:p-8 mb-10 flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
              <Crown className="w-6 h-6" />
            </div>
            <p className="text-sm md:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {t(
                'You are on Wist Enterprise. Billing changes are managed by your account team — contact support if you need help.'
              )}
            </p>
          </div>
        )}

        {!isEnterprise && hasStripeCustomer && (
          <div className="mb-10 rounded-2xl border border-beige-200 dark:border-dpurple-700 bg-beige-100 dark:bg-dpurple-900/50 p-6 md:p-7 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                    {t('Billing & payment method')}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-lg leading-relaxed">
                    {t('Use the Stripe customer portal for invoices, payment details, and cancellation.')}
                  </p>
                  {pmSummary === 'loading' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                      <span>{t('Loading card…')}</span>
                    </div>
                  )}
                  {pmSummary &&
                    pmSummary !== 'loading' &&
                    pmSummary !== 'none' &&
                    pmSummary.last4 && (
                      <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {(() => {
                          const raw = (pmSummary.brand || 'card').toLowerCase();
                          const brandLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
                          return t('{brand} ···· {last4}')
                            .replace('{brand}', brandLabel)
                            .replace('{last4}', pmSummary.last4);
                        })()}
                        {pmSummary.expMonth != null && pmSummary.expYear != null ? (
                          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                            ({String(pmSummary.expMonth).padStart(2, '0')}/{String(pmSummary.expYear).slice(-2)})
                          </span>
                        ) : null}
                      </p>
                    )}
                  {pmSummary === 'none' && (
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t('No saved card on file.')}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openPortal}
                disabled={portalLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-300 dark:border-dpurple-600 bg-white dark:bg-dpurple-800 text-zinc-800 dark:text-zinc-100 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-dpurple-700 disabled:opacity-60 transition-colors shrink-0"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {t('Invoices & payment method')}
              </button>
            </div>
          </div>
        )}

        <div id="compare-plans" className="mb-4 flex items-end justify-between gap-4 scroll-mt-24">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('Compare plans')}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t('Monthly billing · Cancel anytime')}</p>
          </div>
        </div>

        <div className="grid gap-5 lg:gap-6 lg:grid-cols-3">
          <PlanCard
            title={t(TIERS.free.displayName)}
            price={TIERS.free.priceLabel}
            description={t('Get started with core wishlist tools.')}
            features={TIERS.free.features.slice(0, 6)}
            icon={<Sparkles className="w-4 h-4 text-zinc-500" />}
            variant="muted"
            cta={tier === 'free' ? t('Your current plan') : t('Included on higher plans')}
            disabled
            loading={false}
            onSubscribe={() => {}}
          />
          <PlanCard
            title={t(TIERS.pro.displayName)}
            price={TIERS.pro.priceLabel}
            description={t('Unlimited items, 12-hour checks, gifting, sync, and more.')}
            features={TIERS.pro.features.slice(0, 7)}
            icon={<Diamond className="w-4 h-4 text-violet-600" />}
            variant="popular"
            popularLabel={t('Most popular')}
            cta={
              tier === 'pro'
                ? t('Your current plan')
                : tier === 'creator' || tier === 'enterprise'
                  ? hasStripeSubscription
                    ? t('Switch to Pro')
                    : t('Included with your Creator plan')
                  : t('Subscribe to Pro')
            }
            disabled={
              tier === 'pro' || isEnterprise || (tier === 'creator' && !hasStripeSubscription)
            }
            loading={checkoutLoading === 'pro' || switchLoading === 'pro'}
            onSubscribe={() =>
              tier === 'creator' && hasStripeSubscription
                ? void beginPlanChangeWithPreview('pro')
                : startCheckout('pro')
            }
          />
          <PlanCard
            title={t(TIERS.creator.displayName)}
            price={TIERS.creator.priceLabel}
            description={t('Everything in Pro plus faster checks, analytics, and creator badge.')}
            features={TIERS.creator.features}
            icon={<Crown className="w-4 h-4 text-amber-600" />}
            variant="creator"
            cta={
              tier === 'creator'
                ? t('Your current plan')
                : tier === 'pro' && hasStripeSubscription
                  ? t('Upgrade to Creator')
                  : t('Subscribe to Creator')
            }
            disabled={tier === 'creator' || isEnterprise}
            loading={checkoutLoading === 'creator' || switchLoading === 'creator'}
            onSubscribe={() =>
              tier === 'pro' && hasStripeSubscription
                ? void beginPlanChangeWithPreview('creator')
                : startCheckout('creator')
            }
            extra={
              <a
                href="mailto:julien@nitron.digital?subject=Wist Creator Program"
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline mt-3 inline-block text-center w-full"
              >
                {t('Prefer to apply for the Creator program instead?')}
              </a>
            }
          />
        </div>

        <div className="mt-10 md:mt-12 rounded-2xl border border-beige-200 dark:border-dpurple-700 bg-beige-100/80 dark:bg-dpurple-900/40 px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 text-zinc-600 dark:text-zinc-400">
              <Shield className="w-5 h-5 text-violet-500 shrink-0" />
              <p className="text-sm leading-relaxed">
                {t('Prices are billed monthly through Stripe. You can cancel anytime from the billing portal.')}
              </p>
            </div>
            <Link
              href="/support"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
              {t('Questions? Contact support')}
            </Link>
          </div>
        </div>
      </div>

      {planChangeFlow && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-change-title"
          onClick={() => !switchLoading && closePlanChangeFlow()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-beige-200 dark:border-dpurple-600 bg-beige-50 dark:bg-dpurple-900 shadow-xl max-h-[min(90vh,560px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 md:p-6 border-b border-beige-200 dark:border-dpurple-700 shrink-0">
              <h2
                id="plan-change-title"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-50 pr-8"
              >
                {t('Confirm plan change')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {t('Stripe will prorate your subscription. Totals are an estimate until the invoice finalizes.')}
              </p>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto flex-1 min-h-0">
              {planChangeFlow.loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin" aria-hidden />
                  <span className="text-sm">{t('Calculating proration…')}</span>
                </div>
              )}

              {!planChangeFlow.loading && planChangeFlow.error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-900 dark:text-red-100">
                  {planChangeFlow.error}
                </div>
              )}

              {!planChangeFlow.loading && planChangeFlow.preview && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      {planChangeFlow.preview.amountDue > 0
                        ? t('Amount due now')
                        : planChangeFlow.preview.amountDue < 0
                          ? t('Estimated credit')
                          : t('No payment due now')}
                    </p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 tabular-nums">
                      {formatStripeMoney(
                        planChangeFlow.preview.amountDue,
                        planChangeFlow.preview.currency
                      )}
                    </p>
                  </div>

                  {planChangeFlow.preview.lineItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                        {t('Invoice lines')}
                      </p>
                      <ul className="space-y-2 text-sm">
                        {planChangeFlow.preview.lineItems.map((line, i) => (
                          <li
                            key={`${line.description ?? 'line'}-${i}`}
                            className="flex justify-between gap-3 text-zinc-700 dark:text-zinc-300"
                          >
                            <span className="min-w-0 break-words">
                              {line.description || t('Subscription')}
                              {line.proration ? (
                                <span className="ml-1 text-xs text-violet-600 dark:text-violet-400">
                                  ({t('Proration')})
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium">
                              {formatStripeMoney(line.amount, line.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 md:p-6 border-t border-beige-200 dark:border-dpurple-700 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end shrink-0">
              <button
                type="button"
                onClick={closePlanChangeFlow}
                disabled={Boolean(switchLoading)}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 dark:border-dpurple-600 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-dpurple-800 disabled:opacity-50"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmPlanChangeFromPreview}
                disabled={
                  Boolean(switchLoading) ||
                  planChangeFlow.loading ||
                  Boolean(planChangeFlow.error) ||
                  !planChangeFlow.preview
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {switchLoading === planChangeFlow.target ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : null}
                {t('Confirm switch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function PlanCard({
  title,
  price,
  description,
  features,
  cta,
  disabled,
  loading,
  onSubscribe,
  extra,
  variant,
  popularLabel,
  icon,
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  disabled: boolean;
  loading: boolean;
  onSubscribe: () => void;
  extra?: ReactNode;
  variant: 'muted' | 'popular' | 'creator';
  popularLabel?: string;
  icon?: ReactNode;
}) {
  const { t } = useTranslation();
  const base =
    'relative rounded-2xl border p-6 md:p-7 flex flex-col h-full transition-shadow duration-200';
  const styles =
    variant === 'popular'
      ? 'border-violet-300 dark:border-violet-700 bg-white dark:bg-dpurple-900/60 shadow-lg shadow-violet-500/10 dark:shadow-none ring-1 ring-violet-200/60 dark:ring-violet-800/40'
      : variant === 'creator'
        ? 'border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/15 dark:to-dpurple-900/50'
        : 'border-zinc-200 dark:border-dpurple-700 bg-beige-100 dark:bg-dpurple-900/35';

  return (
    <div className={`${base} ${styles}`}>
      {variant === 'popular' && popularLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            {popularLabel}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <p className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-1">{price}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed min-h-[2.5rem]">{description}</p>
      <ul className="space-y-2.5 mb-8 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
            <Check
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                variant === 'creator' ? 'text-amber-600 dark:text-amber-500' : 'text-violet-500 dark:text-violet-400'
              }`}
            />
            <span className="leading-snug">{t(f)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={disabled || loading}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
          disabled
            ? 'bg-zinc-100 dark:bg-dpurple-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-transparent'
            : variant === 'creator'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md hover:shadow-lg'
        }`}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : cta}
      </button>
      {extra}
    </div>
  );
}
