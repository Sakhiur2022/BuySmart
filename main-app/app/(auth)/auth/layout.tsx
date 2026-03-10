import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full border-b h-14 flex items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span>BuySmart</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-6 md:p-10 bg-muted/30">
        {children}
      </main>
      <footer className="w-full border-t h-12 flex items-center justify-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BuySmart — CSE327 Spring 2026
      </footer>
    </div>
  );
}
