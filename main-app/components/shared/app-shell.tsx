'use client';

import { usePathname } from 'next/navigation';

type AppShellProps = {
  children: React.ReactNode;
  navbar: React.ReactNode;
  footer: React.ReactNode;
  chatbot: React.ReactNode;
};

export function AppShell({ children, navbar, footer, chatbot }: AppShellProps) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith('/auth');

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      {navbar}
      <main className="min-h-screen">{children}</main>
      {footer}
      {chatbot}
    </>
  );
}
