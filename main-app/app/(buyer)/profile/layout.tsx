export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
