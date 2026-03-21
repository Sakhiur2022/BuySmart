import Link from 'next/link';
import { RecommendationPanel } from '@/components/recommendations/recommendation-panel';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { ConnectSupabaseSteps } from '@/components/shared/tutorial/connect-supabase-steps';
import { SignUpUserSteps } from '@/components/shared/tutorial/sign-up-user-steps';
import type { ProductCandidate } from '@/lib/agents/recommendation/types';
import { createClient } from '@/lib/supabase/server';
import { hasEnvVars } from '@/lib/utils';

const STAT_BLOCKS = [
  { label: 'SKUs enriched', value: '18k+', detail: 'Synced every 24h' },
  { label: 'Cohort playbooks', value: '42', detail: 'Buyer archetypes live' },
  { label: 'Latency p95', value: '520ms', detail: 'Edge orchestration' },
  { label: 'Budget compliance', value: '94%', detail: 'Constraints honored' },
];

const WORKFLOW_STEPS = [
  {
    title: 'Intent orchestration',
    detail:
      'Capture multi-sentence briefs, clean them, and stream context to the agent in seconds.',
  },
  {
    title: 'Constraint enforcement',
    detail: 'Tight budget, brand, and availability guardrails run before the API call is made.',
  },
  {
    title: 'Multi-signal scoring',
    detail: 'Blend embeddings, behavioral metrics, and stock freshness to rank every SKU.',
  },
  {
    title: 'Explainable outputs',
    detail: 'Present marketing-ready reasoning your sales team can reuse instantly.',
  },
];

const SIGNALS = [
  'Clickstream quality tiers',
  'Inventory freshness windows',
  'Vector similarities in Supabase',
  'Margin guardrails & promo flags',
  'Post-purchase sentiment',
];

export default async function Home() {
  let userEmail: string | null = null;
  let userDisplayName: string | undefined;
  let userRole: string | null = null;
  let candidates: ProductCandidate[] = [];

  if (hasEnvVars) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    userEmail = user?.email ?? null;
    userDisplayName =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined);

    // Fetch user role from profile
    if (user?.id) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('user_id', user.id)
        .single();
      userRole = profile?.role ?? null;
    }

    const { data: products } = await supabase
      .from('products')
      .select('product_id, name, category_id, price, tags')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);

    candidates = (products ?? []).map((product) => ({
      id: product.product_id,
      title: product.name,
      category_id: product.category_id ?? undefined,
      price: product.price,
      tags: product.tags ?? undefined,
    }));
  }

  const isAuthenticated = Boolean(userEmail);
  const isSeller = userRole === 'seller';
  const shouldShowSellerCTA = !isSeller;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative isolate flex min-h-screen flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(230,57,70,0.15),transparent_65%)]"
        />
        <section className="relative w-full border-b border-white/5 bg-linear-to-br from-primary/5 via-background to-background">
          <div
            aria-hidden
            className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
          />

          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-24 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Recommendation studio
              </span>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
                Build a contextual buying copilot your sales team can trust.
              </h1>
              <p className="max-w-xl text-base text-muted-foreground">
                BuySmart ingests customer intent, catalog data, and live constraints to produce
                ranked product shortlists with explanations that feel hand-written. Plug it into
                your marketplace or internal tooling without babysitting prompts.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="#recommendation-workspace"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:translate-y-0.5"
                >
                  Use the recommendation workspace
                </Link>
                <Link
                  href="#integration-playbook"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                >
                  Review the integration plan
                </Link>
              </div>
              {shouldShowSellerCTA ? (
                <p className="flex items-center gap-2 text-lg font-medium text-muted-foreground">
                  <span className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 p-1 text-primary" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 10h18" />
                      <path d="M4 10l2-6h12l2 6" />
                      <path d="M5 10v8h14v-8" />
                      <path d="M9 18v-6h6v6" />
                    </svg>
                  </span>
                  <span>
                    Want to sell on BuySmart?{' '}
                    <Link
                      href="/auth/seller-sign-up"
                      className="font-semibold text-primary hover:underline"
                    >
                      Sign up as a seller
                    </Link>
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-background/80 p-6 shadow-xl shadow-primary/10">
              {STAT_BLOCKS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 dark:bg-white/5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="recommendation-workspace"
          className="w-full bg-neutral-50/70 px-6 py-20 dark:bg-neutral-950/40"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary dark:bg-background">
                Live control room
              </span>
              <h2 className="text-3xl font-semibold leading-tight">Recommendation Workbench</h2>
              <p className="text-base text-muted-foreground">
                Configure constraints, inspect agent rationales, and monitor latency from a single
                surface. Your merchandisers gain a tactile way to test briefs before exposing them
                to buyers.
              </p>

              <ul className="space-y-4">
                {WORKFLOW_STEPS.map((step) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className="mt-1 inline-block size-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-primary/20 bg-white/70 p-5 text-sm dark:bg-background">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                  Signal coverage
                </p>
                <ul className="mt-4 space-y-2 text-muted-foreground">
                  {SIGNALS.map((signal) => (
                    <li key={signal} className="flex items-center gap-2">
                      <span className="inline-block size-1.5 rounded-full bg-primary" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-4xlrder border-white/20 bg-background/90 p-2 shadow-2xl shadow-primary/20">
              <RecommendationPanel
                isAuthenticated={isAuthenticated}
                userEmail={userEmail}
                userDisplayName={userDisplayName}
                candidates={candidates}
              />
            </div>
          </div>
        </section>

        <section id="integration-playbook" className="w-full px-6 py-20">
          <div className="mx-auto max-w-5xl rounded-4xl border border-white/10 bg-card/70 p-8 shadow-xl shadow-primary/10">
            <div className="grid gap-10 md:grid-cols-2">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
                  Integration runbook
                </span>
                <h3 className="text-2xl font-semibold">Connect Supabase & hydrate the agent</h3>
                <p className="text-base text-muted-foreground">
                  Wire up authentication, stream embeddings, and ship your first recommendation API
                  call. Follow the guided runbook on the right to decide whether you want buyer
                  onboarding or internal QA first.
                </p>
                <p className="text-sm text-muted-foreground">
                  Everything runs on the same Supabase stack that powers the starter kit, so you
                  keep type safety, row-level security, and deploys through Vercel.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-muted/50 p-4">
                {hasEnvVars ? <SignUpUserSteps /> : <ConnectSupabaseSteps />}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-background/80 px-6 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Built with Supabase, hardened for AI commerce.</p>
            <div className="flex items-center gap-3">
              <Link
                href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                className="font-semibold text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Supabase
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
