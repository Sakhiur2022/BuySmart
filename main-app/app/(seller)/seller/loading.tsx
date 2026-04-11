export default function SellerDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-24 rounded-xl border bg-card shadow-sm animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`stat-skeleton-${index}`}
            className="h-28 rounded-xl border bg-card shadow-sm animate-pulse"
          />
        ))}
      </div>
      <div className="h-96 rounded-xl border bg-card shadow-sm animate-pulse" />
      <div className="h-80 rounded-xl border bg-card shadow-sm animate-pulse" />
      <div className="h-80 rounded-xl border bg-card shadow-sm animate-pulse" />
    </div>
  );
}
