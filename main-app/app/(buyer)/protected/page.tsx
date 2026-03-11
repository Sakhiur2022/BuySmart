import { redirect } from 'next/navigation'

import { RecommendationPanel } from '@/components/recommendations/recommendation-panel'
import { LogoutButton } from '@/components/shared/logout-button'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <h1 className="text-2xl font-semibold">Buyer Dashboard</h1>
          <p className="text-sm text-muted-foreground">{data.claims.email}</p>
        </div>

        <LogoutButton />
      </section>

      <RecommendationPanel />
    </div>
  )
}
