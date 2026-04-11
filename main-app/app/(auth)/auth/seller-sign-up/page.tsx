import { Suspense } from 'react';
import { SignUpForm } from '@/components/forms/sign-up-form';
import { SellerUpgradeGate } from './seller-upgrade-gate';

const BENEFITS = [
  {
    title: 'List products in minutes',
    detail: 'Publish items, set inventory, and sync updates from one place.',
  },
  {
    title: 'Reach more buyers',
    detail: 'Surface your catalog inside personalized recommendation flows.',
  },
  {
    title: 'Track revenue with clarity',
    detail: 'Monitor sales trends, orders, and top performers in real time.',
  },
];

export default function SellerSignUpPage() {
  return (
    <div className="relative isolate w-full self-stretch -mx-6 -my-6 md:-mx-10 md:-my-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(230,57,70,0.15),transparent_65%)]"
      />
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-6 py-6 md:px-10 md:py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Sell on BuySmart
            </span>
            <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Open your seller workspace and start shipping faster.
            </h1>
            <p className="text-base text-muted-foreground">
              Build your storefront, keep inventory tight, and track real-time performance with the
              same Supabase-powered stack that runs the marketplace.
            </p>

            <div className="grid gap-4">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-2xl border border-primary/20 bg-white/70 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                  <p className="text-sm text-muted-foreground">{benefit.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-5 text-sm text-muted-foreground">
              Already have an account? Sign in and head straight to your seller dashboard.
            </div>
          </section>

          <section className="w-full max-w-sm justify-self-center lg:justify-self-end">
            <Suspense fallback={<p className="text-center text-muted-foreground">Loading...</p>}>
              <SellerUpgradeGate>
                <SignUpForm defaultRole="seller" hideRoleSelect />
              </SellerUpgradeGate>
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}
