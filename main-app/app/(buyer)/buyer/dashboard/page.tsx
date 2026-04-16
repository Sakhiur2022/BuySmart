import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BuyerDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Buyer dashboard</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Track orders, saved items, and recent activity in one place.
          </p>
        </div>
      </section>

      <section aria-label="Buyer dashboard metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>In progress</span>
              <span className="font-semibold text-foreground">2</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deliveries this week</span>
              <span className="font-semibold text-foreground">1</span>
            </div>
            <Button asChild size="sm" className="w-full">
              <Link href="/buyer/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Wishlist items</span>
              <span className="font-semibold text-foreground">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Price drops</span>
              <span className="font-semibold text-foreground">2</span>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/buyer/products">Review saved list</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent views</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Smart speaker mini</span>
              <span className="text-xs">2h ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Kitchen starter kit</span>
              <span className="text-xs">Yesterday</span>
            </div>
            <Button asChild size="sm" variant="ghost" className="w-full">
              <Link href="/buyer/products">Keep browsing</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
