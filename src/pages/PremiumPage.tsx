import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Crown,
  FileText,
  Puzzle,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

type BillingPeriod = 'monthly' | 'yearly';

const PRICING = {
  monthly: { amount: 9.99, label: '/month', billedAs: 'Billed monthly' },
  yearly: { amount: 79.99, label: '/year', billedAs: 'Billed yearly · save ~33%' },
} as const;

const PREMIUM_HIGHLIGHTS = [
  {
    icon: Search,
    title: 'Unlimited analyses',
    description: 'Import and review as many games as you want — no monthly cap.',
  },
  {
    icon: FileText,
    title: 'Deeper reports',
    description: 'Style detection, weekly insights, and sharper improvement plans.',
  },
  {
    icon: Swords,
    title: 'Opponent scouting',
    description: 'Battle plans and practice against how your next opponent really plays.',
  },
  {
    icon: Puzzle,
    title: 'Focused training',
    description: 'Puzzle and practice tools tuned to the patterns holding you back.',
  },
] as const;

const COMPARISON_ROWS: Array<{
  feature: string;
  free: string | boolean;
  premium: string | boolean;
}> = [
  { feature: 'Game analyses', free: '5 / month', premium: 'Unlimited' },
  { feature: 'Progress tracking', free: true, premium: true },
  { feature: 'Basic puzzles', free: true, premium: true },
  { feature: 'Advanced style detection', free: false, premium: true },
  { feature: 'Weekly performance reports', free: false, premium: true },
  { feature: 'Opponent scouting & practice', free: false, premium: true },
  { feature: 'Priority coaching tools', free: false, premium: true },
];

const FAQ_ITEMS = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Premium stays active through the end of your billing period, then returns to Free.',
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer: 'Your games, reports, and profile stay saved. You simply return to Free plan limits.',
  },
  {
    question: 'Is Coach included?',
    answer: 'Coach is a separate plan for managing students. Premium is for individual training.',
  },
] as const;

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</span>;
  }
  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300">
        <Check className="h-4 w-4" aria-hidden />
        Included
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
      <X className="h-4 w-4" aria-hidden />
      —
    </span>
  );
}

const PremiumPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  if (!currentUser) return null;

  const price = PRICING[billingPeriod];
  const isPremium = currentUser.isPremium;

  const handleUpgrade = () => {
    // Payment provider TBD — wire checkout here when ready.
    setCheckoutMessage(
      'Checkout is not connected yet. Payment will be added once the provider is chosen.'
    );
  };

  return (
    <div className="section-shell space-y-10 py-8 sm:space-y-12 sm:py-10">
      <section className="aurora-panel">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">
              Membership
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {isPremium ? 'You’re on Premium' : 'Upgrade to Premium'}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {isPremium
                ? 'Unlimited analysis, deeper reports, and opponent prep are already unlocked on your account.'
                : 'Train without limits — unlimited analyses, sharper reports, and opponent scouting built for real improvement.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isPremium ? (
                <Badge className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-800 dark:text-amber-200">
                  <Crown className="h-3 w-3" />
                  Premium active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  Currently on Free
                </Badge>
              )}
            </div>
          </div>

          {!isPremium && (
            <div className="inline-flex rounded-xl border border-primary-200/80 bg-white/70 p-1 shadow-soft dark:border-slate-700 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  billingPeriod === 'monthly'
                    ? 'bg-primary-700 text-white shadow-soft'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  billingPeriod === 'yearly'
                    ? 'bg-primary-700 text-white shadow-soft'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Yearly
                <span className="ml-2 text-xs font-medium opacity-90">Save</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="relative overflow-hidden border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-primary-50/40 shadow-elevated dark:border-amber-500/30 dark:from-amber-500/10 dark:via-slate-900/80 dark:to-primary-500/10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" />
          <CardHeader className="relative space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-800 dark:text-amber-200">
                <Crown className="h-4 w-4" />
              </span>
              <Badge className="bg-amber-400 text-primary-950 hover:bg-amber-400">Most popular</Badge>
            </div>
            <CardTitle className="font-display text-2xl">Premium</CardTitle>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Everything you need for serious solo training and tournament prep.
            </p>
          </CardHeader>
          <CardContent className="relative space-y-6">
            {isPremium ? (
              <div className="rounded-xl border border-primary-200/70 bg-white/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="font-semibold text-slate-900 dark:text-white">Premium is already active</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Head back to your dashboard and keep training.
                </p>
                <Button
                  type="button"
                  className="mt-4 cursor-pointer"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to dashboard
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      ${price.amount.toFixed(2)}
                    </span>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {price.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{price.billedAs}</p>
                </div>

                <ul className="space-y-2.5">
                  {[
                    'Unlimited game analyses',
                    'Advanced style detection',
                    'Weekly performance reports',
                    'Opponent scouting & practice',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  size="lg"
                  onClick={handleUpgrade}
                  className="w-full cursor-pointer bg-amber-400 text-primary-950 hover:bg-amber-300 hover:text-primary-950"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Button>

                {checkoutMessage && (
                  <p
                    role="status"
                    className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                  >
                    {checkoutMessage}
                  </p>
                )}

                <p className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-300" />
                  Secure checkout will be enabled when payment is connected. Cancel anytime after purchase.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="aurora-subtle border-ink-100/80 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="font-display text-xl">Free vs Premium</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              See what unlocks when you upgrade.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-slate-700">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 bg-ink-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <span>Feature</span>
                <span>Free</span>
                <span>Premium</span>
              </div>
              <ul className="divide-y divide-ink-100 dark:divide-slate-700">
                {COMPARISON_ROWS.map((row) => (
                  <li
                    key={row.feature}
                    className="grid grid-cols-[1.4fr_0.8fr_0.8fr] items-center gap-2 px-3 py-3"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-200">{row.feature}</span>
                    <FeatureCell value={row.free} />
                    <FeatureCell value={row.premium} />
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PREMIUM_HIGHLIGHTS.map((item) => (
          <div
            key={`band-${item.title}`}
            className="rounded-2xl border border-primary-200/60 bg-white/70 p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900/50"
          >
            <item.icon className="h-5 w-5 text-primary-700 dark:text-primary-300" />
            <h3 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="muted-kicker">FAQ</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Before you upgrade
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Straight answers about billing and what stays yours.
          </p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-ink-100 bg-white/80 px-4 py-3 open:shadow-soft dark:border-slate-700 dark:bg-slate-900/60"
            >
              <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:content-none dark:text-white">
                <span className="flex items-center justify-between gap-3">
                  {item.question}
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {!isPremium && (
        <section className="rounded-2xl border border-primary-200/70 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 px-6 py-8 text-white shadow-elevated sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold">Ready for unlimited training?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-primary-50/90">
                Unlock Premium for ${price.amount.toFixed(2)}
                {price.label}. Payment integration comes next — this button is ready to wire up.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={handleUpgrade}
              className="cursor-pointer bg-amber-400 text-primary-950 hover:bg-amber-300 hover:text-primary-950 sm:shrink-0"
            >
              <Crown className="mr-2 h-4 w-4" />
              Upgrade now
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default PremiumPage;
