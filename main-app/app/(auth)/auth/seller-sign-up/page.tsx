import { Suspense } from 'react';
import { SignUpForm } from '@/components/forms/sign-up-form';

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
    <div className="relative isolate w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.18),transparent_60%)]"
      />
      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200/80 bg-sky-100/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
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
                className="rounded-2xl border border-sky-200/60 bg-white/70 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                <p className="text-sm text-muted-foreground">{benefit.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/60 p-5 text-sm text-muted-foreground">
            Already have an account? Sign in and head straight to your seller dashboard.
          </div>
        </section>

        <section className="w-full max-w-sm justify-self-center lg:justify-self-end">
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading...</p>}>
            <SignUpForm defaultRole="seller" hideRoleSelect />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
