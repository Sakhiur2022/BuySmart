import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SellerSalesSummaryPreview } from '@/lib/chatbot/types';

export type SellerSalesSummaryCardProps = {
  preview: SellerSalesSummaryPreview;
  onApproveAllRefunds: () => void;
  isApproving?: boolean;
};

function formatCurrency(amount: number) {
  return `BDT ${amount.toLocaleString('en-US')}`;
}

export function SellerSalesSummaryCard({
  preview,
  onApproveAllRefunds,
  isApproving = false,
}: SellerSalesSummaryCardProps) {
  const refundsCleared = preview.pendingRefundCount === 0;

  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-sky-50/70 shadow-[0_14px_40px_rgba(16,185,129,0.08)]">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600/80">
              Sales summary
            </p>
            <CardTitle className="mt-1 text-lg">
              Your chat summary for {preview.timeframeLabel}
            </CardTitle>
          </div>
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Live</Badge>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          This card pulls the main seller metrics into chat so you can review performance and act on refunds without leaving the conversation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Items sold
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{preview.totalItemsSold}</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Revenue
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(preview.totalRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Top product
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {preview.topProduct?.name ?? 'No top product yet'}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending refunds
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {preview.pendingRefundCount}
            </p>
          </div>
        </div>

        {preview.topProduct ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-sky-900">
            Top product: {preview.topProduct.name} with {preview.topProduct.itemsSold} items sold.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            onClick={onApproveAllRefunds}
            disabled={isApproving || refundsCleared}
            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
          >
            {isApproving
              ? 'Approving refunds...'
              : refundsCleared
                ? 'All refunds approved'
                : 'Approve all refunds'}
          </Button>
          {!refundsCleared ? (
            <p className="self-center text-xs text-slate-500">
              Pending refunds can be cleared directly from chat.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}