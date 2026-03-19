import { RecommendationPanel } from '@/components/recommendations/recommendation-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role === 'seller') {
      redirect('/seller');
    }
  }

  const isAuthenticated = Boolean(user);
  const buyerName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    'Guest Buyer';

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              {isAuthenticated ? 'Registered Buyer' : 'Guest Buyer'}
            </Badge>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Welcome, {buyerName}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {isAuthenticated
                ? 'Your recommendation tools are ready. Share your preferences and get AI-ranked products.'
                : 'Browse and generate AI-powered recommendations instantly. Sign in later to save preferences and unlock richer personalization.'}
            </p>
          </div>

          {!isAuthenticated ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <RecommendationPanel
        isAuthenticated={isAuthenticated}
        userEmail={user?.email ?? null}
        userDisplayName={buyerName}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Intent-Driven Matching</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Explain what you need in plain language and get ranked product matches.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budget-Aware Results</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apply budget ranges and result limits to keep recommendations practical.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transparent Reasoning</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every recommendation includes a short rationale and confidence score.
          </CardContent>
        </Card>
      </section>

      {!isAuthenticated ? (
        <Card className="border-primary/20 bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-lg">Continue as guest, upgrade anytime</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground">
              Guest mode stays open for exploration. Create an account when you want to save
              activity, sync devices, and receive improved personalization.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/auth/sign-up">Unlock full buyer features</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
