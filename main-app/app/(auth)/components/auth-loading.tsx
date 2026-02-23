'use client';

type AuthLoadingProps = {
  label?: string;
};

export function AuthLoading({ label = 'Redirecting to provider...' }: AuthLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
