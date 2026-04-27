import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminRefundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Refund Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage refund requests from buyers.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Queue Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium text-foreground">No refund requests yet</p>
              <p className="text-xs text-muted-foreground">
                When a buyer requests a refund, the entry will appear in this queue.
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-9 rounded-md bg-muted/60" />
              <div className="h-9 rounded-md bg-muted/60" />
              <div className="h-9 rounded-md bg-muted/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Filter controls will live here.
            </div>
            <div className="space-y-2">
              <div className="h-8 rounded-md bg-muted/60" />
              <div className="h-8 rounded-md bg-muted/60" />
              <div className="h-8 rounded-md bg-muted/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          State Samples
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Loading queue</p>
                <p className="text-xs text-muted-foreground">Waiting for refund data.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-6">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Empty state</p>
                <p className="text-xs text-muted-foreground">No requests to review.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Error state</p>
                <p className="text-xs text-muted-foreground">Unable to load refunds.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
