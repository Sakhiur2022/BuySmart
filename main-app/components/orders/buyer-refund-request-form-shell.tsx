import React from "react";

export default function BuyerRefundRequestFormShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md p-8 mt-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Request a Refund</h2>
      <div>{children}</div>
    </div>
  );
}
