import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { CartProvider } from '@/lib/context/cart-context';
import './globals.css';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Buy Smart',
  description:
    'AI-Assisted E-Commerce Platform with Multi-Agent Support and Intelligent Workflow Management',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CartProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
