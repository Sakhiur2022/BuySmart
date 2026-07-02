"use client";

import { useState } from 'react';
import { AlertCircle, InboxIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * EmptyStateCard - Displays when no refunds are found
 * Provides contextual guidance and actionable next steps
 */
export function RefundEmptyState({
  title = 'No refund requests',
  description = 'You haven\'t submitted any refund requests yet.',
  actionText,
  actionHref,
  variant = 'default',
}: {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  variant?: 'default' | 'admin' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <InboxIcon className="h-5 w-5 opacity-50" />
          <span>{description}</span>
        </div>
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <InboxIcon className="h-8 w-8 text-slate-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          {actionText && actionHref && (
            <Button asChild size="sm" className="mt-2">
              <Link href={actionHref}>{actionText}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <InboxIcon className="h-8 w-8 text-slate-400" />
        <div className="space-y-2">
          <p className="text-base font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{description}</p>
          {actionText && actionHref && (
            <p className="pt-2">
              <Button asChild size="sm" variant="outline">
                <Link href={actionHref}>{actionText}</Link>
              </Button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ErrorStateCard - Displays when an error occurs
 * Provides context about what went wrong and recovery suggestions
 */
export function RefundErrorState({
  title = 'Unable to load refunds',
  message = 'An error occurred while fetching refund requests.',
  actionText,
  onAction,
  details,
}: {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  details?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8">
      <div className="flex gap-4">
        <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium text-red-900">{title}</p>
            <p className="mt-1 text-sm text-red-800">{message}</p>
            {details && <p className="mt-2 text-xs text-red-700 font-mono bg-red-100 p-2 rounded">{details}</p>}
          </div>
          {actionText && onAction && (
            <div className="pt-2">
              <Button size="sm" onClick={onAction} variant="outline">
                {actionText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * LoadingStateCard - Displays while fetching refund data
 * Provides context about what's being loaded
 */
export function RefundLoadingState({
  message = 'Loading refund requests...',
  variant = 'default',
}: {
  message?: string;
  variant?: 'default' | 'inline' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

/**
 * FormErrorAlert - Displays form submission errors with guidance
 */
export function FormErrorAlert({
  message,
  suggestion,
  onDismiss,
}: {
  message: string;
  suggestion?: string;
  onDismiss?: () => void;
}) {
  const [showFallback, setShowFallback] = useState(false);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center animate-in slide-in-from-left-6">
            <svg viewBox="0 0 48 48" className="h-6 w-6 text-red-700" aria-hidden>
              <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.08" />
              <g fill="currentColor">
                <path d="M24 12c3.866 0 7 3.134 7 7s-3.134 7-7 7-7-3.134-7-7 3.134-7 7-7z" />
                <path d="M15 32c1.5-3 5-5 9-5s7.5 2 9 5v1H15v-1z" opacity="0.9" />
              </g>
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <p className="font-medium">{message}</p>
          {suggestion && <p className="mt-1 text-red-800">{suggestion}</p>}

          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => setShowFallback((s) => !s)}>
              {showFallback ? 'Hide manual steps' : 'Try manual fallback'}
            </Button>
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>

      {showFallback && (
        <div
          role="region"
          aria-live="polite"
          className="mt-2 rounded-md border border-red-100 bg-white p-3 text-red-900 animate-in slide-in-from-bottom-6"
        >
          <p className="text-sm font-medium">Quick manual fallback</p>
          <ol className="mt-2 list-decimal pl-5 text-xs text-red-800">
            <li>Copy your order ID and the refund message shown above.</li>
            <li>Reach out to support via the Help center or email with these details.</li>
            <li>Attach a screenshot and any photos of the item if relevant.</li>
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/help/contact">Contact support</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/buyer/orders`}>Go to orders</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FormSuccessAlert - Displays successful form submission with next steps
 */
export function FormSuccessAlert({
  title,
  message,
  details,
  actionText,
  actionHref,
  onDismiss,
}: {
  title: string;
  message: string;
  details?: { label: string; value: string | React.ReactNode }[];
  actionText?: string;
  actionHref?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center animate-in slide-in-from-left-6">
            <svg viewBox="0 0 48 48" className="h-6 w-6 text-emerald-700" aria-hidden>
              <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.06" />
              <g fill="currentColor">
                <path d="M24 14c2.761 0 5 2.239 5 5s-2.239 5-5 5-5-2.239-5-5 2.239-5 5-5z" />
                <path d="M17 32c2-2.5 6-4 10-4s8 1.5 10 4v1H17v-1z" opacity="0.9" />
              </g>
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-emerald-800">{message}</p>
          {details && (
            <div className="mt-3 space-y-1 text-xs">
              {details.map((detail, index) => (
                <p key={index}>
                  <span className="font-medium">{detail.label}:</span> <span className="font-mono">{detail.value}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-emerald-700 hover:text-emerald-900 transition flex-shrink-0"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
      {actionText && actionHref && (
        <div className="pt-2 border-t border-emerald-200">
          <Button asChild size="sm" variant="outline" className="border-emerald-300 hover:bg-emerald-100">
            <Link href={actionHref}>{actionText}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * NoResultsForFilter - When filters result in no items
 */
export function NoResultsForFilter({
  message = 'No refund requests match the current filter.',
  suggestion = 'Try adjusting your filter options to find what you\'re looking for.',
  onClearFilters,
}: {
  message?: string;
  suggestion?: string;
  onClearFilters?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <InboxIcon className="h-8 w-8 text-amber-600" />
        <div className="space-y-2">
          <p className="text-base font-medium text-amber-900">{message}</p>
          <p className="text-sm text-amber-800">{suggestion}</p>
          {onClearFilters && (
            <p className="pt-2">
              <Button onClick={onClearFilters} size="sm" variant="outline">
                Clear filters
              </Button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
