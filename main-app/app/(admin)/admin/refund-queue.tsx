"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { RefundAIDecision, RefundStatus } from "@/lib/models/refund.model";
import type {
  RefundListResponseDTO,
  RefundSummaryDTO,
} from "@/lib/types/refund.types";
import { REFUND_STATUS_VALUES } from "@/lib/types/refund.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "destructive" | "info";

type RefundQueueItem = RefundSummaryDTO;

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  RefundStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
  },
  ai_review: {
    label: "AI review",
    variant: "outline",
  },
  manual_review: {
    label: "Manual review",
    variant: "outline",
  },
  approved: {
    label: "Approved",
    variant: "default",
  },
  processing: {
    label: "Processing",
    variant: "secondary",
  },
  completed: {
    label: "Completed",
    variant: "default",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
  },
};

const AI_DECISION_CONFIG: Record<
  RefundAIDecision,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  auto_approve: {
    label: "Auto approve",
    variant: "default" as const,
  },
  manual_review: {
    label: "Manual review",
    variant: "secondary" as const,
  },
  auto_reject: {
    label: "Auto reject",
    variant: "destructive" as const,
  },
};

const ACTIONABLE_REFUND_STATUSES = [
  "pending",
  "ai_review",
  "manual_review",
] as const;

type ActionableRefundStatus = (typeof ACTIONABLE_REFUND_STATUSES)[number];

function isActionableRefundStatus(
  status: RefundStatus,
): status is ActionableRefundStatus {
  return ACTIONABLE_REFUND_STATUSES.includes(status as ActionableRefundStatus);
}

function getDisplayStatus(status: RefundStatus): RefundStatus {
  if (isActionableRefundStatus(status)) {
    return "pending";
  }

  return status;
}

function getAIConfidence(item: RefundQueueItem): number | null {
  const analysis = item.ai_analysis;

  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return null;
  }

  const confidence = analysis.confidence;
  return typeof confidence === "number" ? Math.round(confidence * 100) : null;
}

function getAINotes(item: RefundQueueItem): string | null {
  const analysis = item.ai_analysis;

  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return null;
  }

  const notes = analysis.notes;
  return typeof notes === "string" && notes.trim().length > 0 ? notes : null;
}

function getAIDecisionLabel(item: RefundQueueItem): string {
  if (item.ai_recommendation) {
    return AI_DECISION_CONFIG[item.ai_recommendation].label;
  }

  const confidence = getAIConfidence(item);
  const riskScore = item.ai_risk_score;

  if (
    confidence !== null &&
    confidence >= 80 &&
    typeof riskScore === "number"
  ) {
    if (riskScore <= 0.2) {
      return AI_DECISION_CONFIG.auto_approve.label;
    }

    if (riskScore >= 0.8) {
      return AI_DECISION_CONFIG.auto_reject.label;
    }
  }

  return "Leave to admin";
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-72">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border shadow-md text-sm font-medium bg-card"
        >
          <span>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── RiskBar ──────────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number | null | undefined }) {
  const pct = useMemo(() => Math.round((score ?? 0) * 100), [score]);

  const color =
    (score ?? 0) < 0.35
      ? "bg-chart-3"
      : (score ?? 0) < 0.65
      ? "bg-chart-4"
      : "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface QueueRowProps {
  item: RefundQueueItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function QueueRow({ item, onApprove, onReject }: QueueRowProps) {
  const approveRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(
    e: KeyboardEvent<HTMLButtonElement>,
    type: "approve" | "reject"
  ) {
    if (e.key === "ArrowRight" && type === "approve") {
      e.preventDefault();
      rejectRef.current?.focus();
    }
    if (e.key === "ArrowLeft" && type === "reject") {
      e.preventDefault();
      approveRef.current?.focus();
    }
  }

  const formattedAmt = formatCurrency(item.requested_amount);
  const reasonLabel = item.reason_description ?? item.reason_code;
  const aiDecision = item.ai_recommendation;
  const aiDecisionLabel = getAIDecisionLabel(item);
  const aiConfidence = getAIConfidence(item);
  const aiNotes = getAINotes(item);
  const displayStatus = getDisplayStatus(item.status);

  return (
    <TableRow>
      <TableCell>
        {item.buyer_name || item.user_id}
        <div className="text-xs text-muted-foreground">{item.order_id}</div>
      </TableCell>

      <TableCell>{formattedAmt}</TableCell>

      <TableCell>{reasonLabel}</TableCell>

      <TableCell>
        <div className="space-y-2">
          {aiDecision ? (
            <Badge variant={AI_DECISION_CONFIG[aiDecision].variant}>
              {aiDecisionLabel}
            </Badge>
          ) : (
            <div className="text-sm font-medium">{aiDecisionLabel}</div>
          )}
          <RiskBar score={item.ai_risk_score} />
          <div className="text-xs text-muted-foreground">
            Confidence: {aiConfidence !== null ? `${aiConfidence}%` : "N/A"}
          </div>
          {aiNotes ? (
            <div className="text-xs text-muted-foreground">
              {aiNotes}
            </div>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <Badge variant={STATUS_CONFIG[displayStatus].variant}>
          {STATUS_CONFIG[displayStatus].label}
        </Badge>
      </TableCell>

      <TableCell>
        {isActionableRefundStatus(item.status) && (
          <div className="flex gap-2">
            <Button
              ref={approveRef}
              onClick={() => onApprove(item.refund_id)}
              onKeyDown={(e) => handleKeyDown(e, "approve")}
              size="sm"
              variant="default"
            >
              Approve
            </Button>

            <Button
              ref={rejectRef}
              onClick={() => onReject(item.refund_id)}
              onKeyDown={(e) => handleKeyDown(e, "reject")}
              size="sm"
              variant="destructive"
            >
              Reject
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminRefundQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<RefundQueueItem[]>([]);
  const [pagination, setPagination] = useState<
    RefundListResponseDTO["pagination"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const statusParam = searchParams.get("status");
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const statusFilter: RefundStatus | "all" =
    statusParam && REFUND_STATUS_VALUES.includes(statusParam as RefundStatus)
      ? (statusParam as RefundStatus)
      : "all";

  const pageSize = 20;

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([key, value]) => {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadRefunds = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    try {
      const response = await fetch(`/api/refunds?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to load refunds");
      }

      const payload = (await response.json()) as RefundListResponseDTO;
      setItems(payload.refunds ?? []);
      setPagination(payload.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load refunds";
      setError(message);
      setItems([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36);

    setToasts((prev) => [...prev, { id, message, variant }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const applyLocalDecision = useCallback(
    (id: string, nextStatus: RefundStatus) => {
      setItems((prev) => {
        if (statusFilter !== "all" && statusFilter !== nextStatus) {
          return prev.filter((item) => item.refund_id !== id);
        }

        return prev.map((item) =>
          item.refund_id === id ? { ...item, status: nextStatus } : item
        );
      });
    },
    [statusFilter]
  );

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/refunds/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Failed to approve refund");
        }

        applyLocalDecision(id, "approved");
        addToast("Approved", "success");
        await loadRefunds();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to approve refund";
        addToast(message, "destructive");
      }
    },
    [addToast, applyLocalDecision, loadRefunds]
  );

  const handleReject = useCallback(
    async (id: string) => {
      const note = window.prompt("Add a rejection note");
      if (!note) {
        return;
      }

      try {
        const response = await fetch(`/api/refunds/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processing_notes: note }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Failed to reject refund");
        }

        applyLocalDecision(id, "rejected");
        addToast("Rejected", "destructive");
        await loadRefunds();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to reject refund";
        addToast(message, "destructive");
      }
    },
    [addToast, applyLocalDecision, loadRefunds]
  );

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending").length,
    [items]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Refund Queue</h1>
        <p className="text-muted-foreground">
          Manage refund requests ({pendingCount} pending)
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            updateParams({ status: value === "all" ? null : value, page: "1" })
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REFUND_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_CONFIG[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Buyer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>AI Decision</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                Loading refunds...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-destructive">
                {error}
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                No refunds found for the selected filter.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <QueueRow
                key={item.refund_id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TableBody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                updateParams({ page: String(Math.max(pagination.page - 1, 1)) })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                updateParams({
                  page: String(
                    Math.min(pagination.page + 1, pagination.totalPages),
                  ),
                })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ToastList
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />
    </div>
  );
}
