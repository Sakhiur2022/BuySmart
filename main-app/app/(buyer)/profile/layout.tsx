import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
