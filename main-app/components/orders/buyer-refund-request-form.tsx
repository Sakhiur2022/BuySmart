'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormErrorAlert, FormSuccessAlert } from '@/components/orders/refund-state-cards';
import { REFUND_REASON_VALUES } from '@/lib/types/refund.types';

const refundReasonValues = [...REFUND_REASON_VALUES] as [string, ...string[]];

const refundRequestSchema = z.object({
  order_id: z.string().uuid('Order id must be a valid UUID.'),
  refund_type: z.literal('full_order'),
  reason_code: z.enum(refundReasonValues, {
    message: 'Choose a refund reason.',
  }),
  reason_description: z.string().trim().max(1000, 'Reason details must be 1,000 characters or less.'),
  requested_amount: z.number().positive('Refund amount must be greater than zero.').max(1000000, 'Refund amount must be BDT 1,000,000 or less.'),
  return_required: z.boolean(),
  currency: z.literal('USD'),
});

type RefundRequestFormState = {
  reasonCode: string;
  reasonDescription: string;
  requestedAmount: string;
  returnRequired: boolean;
};

type RefundFieldName = keyof Omit<z.input<typeof refundRequestSchema>, 'currency'>;

type RefundFieldErrors = Partial<Record<RefundFieldName, string>>;

type RefundSuccessState = {
  refundId: string;
  refundNumber: string | null;
  requestedAmount: number;
};

type RefundSubmissionNotice = {
  id: string;
  message: string;
};

const initialFormState: RefundRequestFormState = {
  reasonCode: '',
  reasonDescription: '',
  requestedAmount: '',
  returnRequired: false,
};

function prettifyEnumValue(value: string): string {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toFieldErrorMap(error: z.ZodFormattedError<z.infer<typeof refundRequestSchema>>) {
  const fieldErrors: RefundFieldErrors = {};

  for (const [key, value] of Object.entries(error)) {
    if (key === '_errors') {
      continue;
    }

    const fieldKey = key as RefundFieldName;
    const messages = (value as { _errors?: string[] })._errors ?? [];

    if (messages.length > 0) {
      fieldErrors[fieldKey] = messages[0];
    }
  }

  return fieldErrors;
}

export default function BuyerRefundRequestForm({ orderId }: { orderId: string }) {
  const [formState, setFormState] = useState<RefundRequestFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<RefundFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<RefundSuccessState | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<RefundSubmissionNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestedAmount = formState.requestedAmount.trim();
  const parsedAmount = requestedAmount === '' ? Number.NaN : Number(requestedAmount);
  const amountIsReadable = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSubmit =
    !isSubmitting &&
    !successState &&
    formState.reasonCode.length > 0 &&
    amountIsReadable &&
    formState.reasonDescription.length <= 1000;

  useEffect(() => {
    if (!submissionNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSubmissionNotice(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [submissionNotice]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || successState) {
      return;
    }

    const nextFieldErrors: RefundFieldErrors = {};

    if (!Number.isFinite(parsedAmount)) {
      nextFieldErrors.requested_amount = 'Enter a refund amount using numbers only.';
    } else if (parsedAmount <= 0) {
      nextFieldErrors.requested_amount = 'Refund amount must be greater than zero.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Fix the highlighted field before submitting.');
      return;
    }

    const validationResult = refundRequestSchema.safeParse({
      order_id: orderId,
      refund_type: 'full_order',
      reason_code: formState.reasonCode,
      reason_description: formState.reasonDescription.trim(),
      requested_amount: parsedAmount,
      return_required: formState.returnRequired,
      currency: 'USD',
    });

    if (!validationResult.success) {
      setFieldErrors(toFieldErrorMap(validationResult.error.format()));
      setFormError('Fix the highlighted fields and try again.');
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationResult.data),
      });

      const responseBody = (await response.json().catch(() => null)) as
        | { error?: string; issues?: { fieldErrors?: Record<string, string[] | undefined> } | null; refund?: { refund_id?: string; refund_number?: string | null; requested_amount?: number } }
        | null;

      if (!response.ok) {
        if (responseBody?.issues?.fieldErrors) {
          const apiFieldErrors: RefundFieldErrors = {};

          for (const [key, value] of Object.entries(responseBody.issues.fieldErrors)) {
            const fieldKey = key as RefundFieldName;
            const message = value?.[0];

            if (message) {
              apiFieldErrors[fieldKey] = message;
            }
          }

          setFieldErrors(apiFieldErrors);
        }

        setFormError(responseBody?.error ?? 'Unable to submit the refund request right now.');
        return;
      }

      if (!responseBody?.refund?.refund_id) {
        setFormError('Refund request submitted, but the response was incomplete.');
        return;
      }

      setSuccessState({
        refundId: responseBody.refund.refund_id,
        refundNumber: responseBody.refund.refund_number ?? null,
        requestedAmount: responseBody.refund.requested_amount ?? parsedAmount,
      });
      setSubmissionNotice({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36),
        message: 'Refund request submitted successfully.',
      });
      setFormState({
        reasonCode: '',
        reasonDescription: '',
        requestedAmount: '',
        returnRequired: false,
      });
    } catch {
      setFormError('Network error while submitting the refund request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {submissionNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[200] flex justify-center px-4 sm:top-24">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg animate-in slide-in-from-top-6 fade-in"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Refund request submitted</p>
                <p className="mt-1 text-emerald-800">{submissionNotice.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionNotice(null)}
                className="text-emerald-700 transition hover:text-emerald-900"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {successState ? (
        <FormSuccessAlert
          title="Refund request submitted successfully"
          message="Your refund request has been received and is now under review. You'll receive updates via email as the refund process progresses."
          details={[
            { label: 'Refund ID', value: successState.refundId },
            ...(successState.refundNumber ? [{ label: 'Refund Number', value: successState.refundNumber }] : []),
            { label: 'Requested Amount', value: `BDT ${successState.requestedAmount.toFixed(2)}` },
          ]}
          actionText="View refund details"
          actionHref={`/buyer/refunds/${successState.refundId}`}
        />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Refund request for order</p>
        <p className="mt-1 break-all text-xs text-slate-600">{orderId}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Refund type: Full order</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="refund-reason">Refund reason</Label>
        <Select
          value={formState.reasonCode}
          onValueChange={(value) => setFormState((current) => ({ ...current, reasonCode: value }))}
          disabled={isSubmitting || Boolean(successState)}
        >
          <SelectTrigger id="refund-reason" aria-invalid={Boolean(fieldErrors.reason_code)}>
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {REFUND_REASON_VALUES.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {prettifyEnumValue(reason)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.reason_code ? <p className="text-sm text-red-600">{fieldErrors.reason_code}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="refund-amount">Requested amount</Label>
        <Input
          id="refund-amount"
          name="requestedAmount"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={formState.requestedAmount}
          onChange={(event) =>
            setFormState((current) => ({ ...current, requestedAmount: event.target.value }))
          }
          disabled={isSubmitting || Boolean(successState)}
          aria-invalid={Boolean(fieldErrors.requested_amount)}
        />
        {fieldErrors.requested_amount ? (
          <p className="text-sm text-red-600">{fieldErrors.requested_amount}</p>
        ) : (
          <p className="text-xs text-slate-500">Use the amount you want refunded from this order.</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="refund-description">Reason details</Label>
        <Textarea
          id="refund-description"
          name="reasonDescription"
          rows={4}
          maxLength={1000}
          placeholder="Add order context, item condition, or any extra detail that supports the refund."
          value={formState.reasonDescription}
          onChange={(event) =>
            setFormState((current) => ({ ...current, reasonDescription: event.target.value }))
          }
          disabled={isSubmitting || Boolean(successState)}
          aria-invalid={Boolean(fieldErrors.reason_description)}
        />
        <div className="flex items-center justify-between gap-4">
          {fieldErrors.reason_description ? (
            <p className="text-sm text-red-600">{fieldErrors.reason_description}</p>
          ) : (
            <p className="text-xs text-slate-500">Optional, up to 1,000 characters.</p>
          )}
          <p className="text-xs text-slate-500">{formState.reasonDescription.length}/1000</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Checkbox
          id="refund-return-required"
          checked={formState.returnRequired}
          onCheckedChange={(checked) =>
            setFormState((current) => ({ ...current, returnRequired: checked === true }))
          }
          disabled={isSubmitting || Boolean(successState)}
          className="mt-0.5"
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="refund-return-required" className="font-medium">
            Return required
          </Label>
          <p className="text-sm text-slate-600">
            Mark this when the refund should wait for the item to be returned.
          </p>
        </div>
      </div>

      {formError && (
        <FormErrorAlert
          message={formError}
          suggestion={
            formError.includes('highlighted field')
              ? 'Please review the form and correct any errors before trying again.'
              : formError.includes('Network error')
              ? 'Check your internet connection and try again.'
              : 'If the problem persists, please contact support.'
          }
          onDismiss={() => setFormError(null)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" disabled={!canSubmit} className="sm:min-w-44">
          {isSubmitting ? 'Submitting refund...' : successState ? 'Refund submitted' : 'Submit refund request'}
        </Button>

        <Button asChild variant="outline">
          <Link href={`/buyer/orders/${orderId}`}>Back to order</Link>
        </Button>
      </div>
      </form>
    </>
  );
}
