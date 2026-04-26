"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type RefundStatus = "pending" | "approved" | "rejected";
type AIDecision = "auto_approve" | "manual_review" | "auto_reject";
type ToastVariant = "success" | "destructive" | "info";

interface RefundQueueItem {
  id: string;
  order_id: string;
  buyer_name: string;
  amount: number;
  reason: string;
  ai_decision: AIDecision;
  ai_risk_score: number;
  status: RefundStatus;
  submitted_at: string;
}

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    variant: "secondary" as const,
  },
  approved: {
    label: "Approved",
    variant: "default" as const,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
  },
};

const AI_DECISION_CONFIG = {
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

function RiskBar({ score }: { score: number }) {
  const pct = useMemo(() => Math.round(score * 100), [score]);

  const color =
    score < 0.35
      ? "bg-chart-3"
      : score < 0.65
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
  idx: number;
}

function QueueRow({ item, onApprove, onReject, idx }: QueueRowProps) {
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

  const formattedAmt = item.amount.toLocaleString("en-US", {
    style: "currency",
    currency: "BDT",
  });

  return (
    <TableRow>
      <TableCell>
        {item.buyer_name}
        <div className="text-xs text-muted-foreground">{item.order_id}</div>
      </TableCell>

      <TableCell>{formattedAmt}</TableCell>

      <TableCell>{item.reason}</TableCell>

      <TableCell>
        <div className="space-y-2">
          <Badge variant={AI_DECISION_CONFIG[item.ai_decision].variant}>
            {AI_DECISION_CONFIG[item.ai_decision].label}
          </Badge>
          <RiskBar score={item.ai_risk_score} />
        </div>
      </TableCell>

      <TableCell>
        <Badge variant={STATUS_CONFIG[item.status].variant}>
          {STATUS_CONFIG[item.status].label}
        </Badge>
      </TableCell>

      <TableCell>
        {item.status === "pending" && (
          <div className="flex gap-2">
            <Button
              ref={approveRef}
              onClick={() => onApprove(item.id)}
              onKeyDown={(e) => handleKeyDown(e, "approve")}
              size="sm"
              variant="default"
            >
              Approve
            </Button>

            <Button
              ref={rejectRef}
              onClick={() => onReject(item.id)}
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

export default function AdminRefundQueue({
  initialItems,
}: {
  initialItems: RefundQueueItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RefundStatus | "all"
  >("all");

  const searchRef = useRef<HTMLInputElement>(null);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // toast
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

  const handleApprove = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "approved" } : i
        )
      );
      addToast("Approved", "success");
    },
    [addToast]
  );

  const handleReject = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "rejected" } : i
        )
      );
      addToast("Rejected", "destructive");
    },
    [addToast]
  );

  // filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.buyer_name.toLowerCase().includes(q) ||
        item.order_id.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

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
        <Input
          ref={searchRef}
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          placeholder="Search by buyer, order ID, or reason..."
          className="max-w-sm"
        />

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as RefundStatus | "all")
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
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
          {filtered.map((item, idx) => (
            <QueueRow
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              idx={idx}
            />
          ))}
        </TableBody>
      </Table>

      <ToastList
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />
    </div>
  );
}