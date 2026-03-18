export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex flex-1 items-center justify-center p-6 md:p-10 bg-muted/30">
        {children}
      </main>
    </div>
  );
}
