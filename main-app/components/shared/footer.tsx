import Link from 'next/link';
import { ShoppingBag, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>BuySmart</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-Assisted E-Commerce Platform with intelligent multi-agent recommendations.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm">Explore</h3>
            <Link
              href="/buyer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Products
            </Link>
            <Link
              href="/protected/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm">Project</h3>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <p className="text-sm text-muted-foreground">CSE327 – Spring 2026</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} BuySmart. Built with Next.js + Supabase + LangChain.
        </div>
      </div>
    </footer>
  );
}
