import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { RefundStatus } from '@/lib/models/refund.model';
import type { RefundSummaryDTO } from '@/lib/types/refund.types';

type BuyerRefundStatusListProps = {
  refunds: RefundSummaryDTO[];
};

const REFUND_STATUS_META: Record<RefundStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
  },
  ai_review: {
    label: 'AI review',
    className: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
  },
  manual_review: {
    label: 'Manual review',
    className: 'border-orange-500/20 bg-orange-500/10 text-orange-700',
  },
  approved: {
    label: 'Approved',
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
  },
  processing: {
    label: 'Processing',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-500/20 bg-red-500/10 text-red-700',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
  },
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-BD', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatRefundType(value: RefundSummaryDTO['refund_type']): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const meta = REFUND_STATUS_META[status] ?? {
    label: status,
    className: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  };

  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

export default function BuyerRefundStatusList({ refunds }: BuyerRefundStatusListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Refund status</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Recent requests from your orders</p>
      </CardHeader>
      <CardContent>
        {refunds.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No refund requests yet.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {refunds.map((refund) => (
              <li key={refund.refund_id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {refund.refund_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Order ID {refund.order_id.slice(0, 8)} - {formatRefundType(refund.refund_type)} -{' '}
                      {formatDate(refund.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <RefundStatusBadge status={refund.status} />
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(refund.refund_amount)}
                    </span>
                    <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                      <Link href={`/buyer/orders/${refund.order_id}`}>Details</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
