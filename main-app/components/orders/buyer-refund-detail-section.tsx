import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { RefundStatus } from '@/lib/models/refund.model';
import type { RefundDetailDTO } from '@/lib/types/refund.types';
import { CheckCircle2, Circle, Clock3, XCircle } from 'lucide-react';

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

type RefundTimelineStep = {
  key: RefundStatus;
  label: string;
  description: string;
  happenedAt: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatEnumLabel(value: string): string {
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

function getRefundTimelineSteps(refund: RefundDetailDTO): RefundTimelineStep[] {
  const base: RefundTimelineStep[] = [
    {
      key: 'pending',
      label: 'Refund requested',
      description: 'We received your refund request and will start reviewing it.',
      happenedAt: refund.created_at,
    },
    {
      key: 'ai_review',
      label: 'AI review',
      description: 'Automated checks are running to assess eligibility and risk.',
      happenedAt: refund.ai_processed_at,
    },
    {
      key: 'manual_review',
      label: 'Manual review',
      description: 'A support agent may review your request and evidence.',
      happenedAt:
        refund.status === 'manual_review' ||
        refund.status === 'approved' ||
        refund.status === 'processing' ||
        refund.status === 'completed' ||
        refund.status === 'rejected' ||
        refund.status === 'cancelled'
          ? refund.processed_at
          : null,
    },
    {
      key: 'approved',
      label: 'Approved',
      description: 'Your refund request has been approved.',
      happenedAt:
        refund.status === 'approved' || refund.status === 'processing' || refund.status === 'completed'
          ? refund.processed_at
          : null,
    },
    {
      key: 'processing',
      label: 'Processing',
      description: 'We are initiating the refund with the payment provider.',
      happenedAt: null,
    },
    {
      key: 'completed',
      label: 'Completed',
      description: 'Refund has been issued successfully.',
      happenedAt: refund.refunded_at,
    },
  ];

  if (refund.status === 'rejected') {
    return [
      base[0],
      base[1],
      base[2],
      {
        key: 'rejected',
        label: 'Rejected',
        description: 'This refund request was rejected.',
        happenedAt: refund.processed_at ?? refund.updated_at,
      },
    ];
  }

  if (refund.status === 'cancelled') {
    return [
      base[0],
      base[1],
      base[2],
      {
        key: 'cancelled',
        label: 'Cancelled',
        description: 'This refund request was cancelled.',
        happenedAt: refund.processed_at ?? refund.updated_at,
      },
    ];
  }

  return base;
}

export default function BuyerRefundDetailSection({ refund }: { refund: RefundDetailDTO }) {
  const steps = getRefundTimelineSteps(refund);
  const currentStepIndex = Math.max(steps.findIndex((step) => step.key === refund.status), 0);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg">Refund detail</CardTitle>
            <p className="text-xs text-muted-foreground">
              {refund.refund_number} • {formatEnumLabel(refund.refund_type)} • {formatEnumLabel(refund.reason_code)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefundStatusBadge status={refund.status} />
            <Badge variant="secondary">Requested: {formatCurrency(refund.requested_amount)}</Badge>
            <Badge variant="secondary">Refund: {formatCurrency(refund.refund_amount)}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm font-semibold">Timeline</p>
            <ol className="space-y-4">
              {steps.map((step, index) => {
                const isCurrent = step.key === refund.status;
                const isTerminal = isCurrent && (refund.status === 'rejected' || refund.status === 'cancelled');
                const reached = index < currentStepIndex;

                return (
                  <li key={step.key} className="relative flex gap-3">
                    <div className="pt-0.5">
                      {isTerminal ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : reached ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : isCurrent ? (
                        <Clock3 className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.happenedAt
                          ? formatDateTime(step.happenedAt)
                          : isCurrent
                            ? 'In progress'
                            : 'Pending'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold">Processing notes</p>
            <div className="rounded-xl border bg-muted/20 p-4 text-sm">
              {refund.processing_notes && refund.processing_notes.trim().length > 0 ? (
                <p className="whitespace-pre-wrap text-foreground">{refund.processing_notes}</p>
              ) : (
                <p className="text-muted-foreground">No processing notes available yet.</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Requested at</span>
                <span className="font-medium">{formatDateTime(refund.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">{formatDateTime(refund.updated_at)}</span>
              </div>
              {refund.return_required ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Return required</span>
                  <span className="font-medium">Yes</span>
                </div>
              ) : null}
              {refund.return_tracking ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Return tracking</span>
                  <span className="font-medium">{refund.return_tracking}</span>
                </div>
              ) : null}
              {refund.return_received_at ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Return received</span>
                  <span className="font-medium">{formatDateTime(refund.return_received_at)}</span>
                </div>
              ) : null}
              {refund.payment_reference ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment reference</span>
                  <span className="font-medium">{refund.payment_reference}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
