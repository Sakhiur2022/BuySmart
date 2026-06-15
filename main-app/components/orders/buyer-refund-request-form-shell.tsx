import React from "react";
import { Info } from "lucide-react";

export default function BuyerRefundRequestFormShell({
  children,
  refundGuide = false,
}: {
  children?: React.ReactNode;
  refundGuide?: boolean;
}) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md p-8 mt-8 space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Request a Refund</h2>
        <p className="text-sm text-slate-600">
          Submit a refund request for your order. Our support team will review and respond within 5-7 business days.
        </p>
      </div>

      {refundGuide ? (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p className="font-semibold">Refund step 3</p>
          <p className="mt-1 text-xs leading-5 text-rose-800">
            Review the form, then use the highlighted Submit refund request button to finish.
          </p>
        </div>
      ) : null}

      {/* Helpful information box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Tips for a faster review:</p>
          <ul className="list-disc list-inside mt-1 space-y-1 text-blue-800">
            <li>Be clear about the reason for your refund</li>
            <li>Provide relevant details in the description</li>
            <li>Include any supporting information</li>
          </ul>
        </div>
      </div>

      <div>{children}</div>

      <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          <span className="font-medium">Status after submission:</span> Your refund will go through AI review first, then manual review if needed.
        </p>
      </div>
    </div>
  );
}
