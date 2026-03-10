# UI-02 — Responsive Layout Shell

**Sprint:** 2 | **Status:** ✅ Complete | **Owner:** ASR

---

## Section 1 — Implementation Summary

### Overview

UI-02 implements the persistent application shell that wraps all authenticated and role-specific pages. This includes a sticky top navigation bar, a three-column footer, and a sidebar-based layout for the Seller Portal. The shell replaces the original Next.js Supabase starter template nav and provides a consistent branded frame across the buyer experience, seller dashboard, and all future pages.

### What Was Built

- **`Navbar`** — Sticky top header with BuySmart brand logo, primary navigation links (Products, Profile), theme switcher, and auth button. Hidden nav links collapse on mobile (shown only on `md:` and above).
- **`Footer`** — Three-column responsive footer with brand description, explore links (Products, Profile, Settings), and project info (GitHub, course name). Collapses to single column on mobile.
- **Buyer protected layout** — Wraps all pages under `app/(buyer)/protected/` with Navbar + centered content container + Footer.
- **Seller layout with sidebar** — Wraps all pages under `app/(seller)/seller/` with Navbar + a fixed-width left sidebar (icon + label nav items) + full-width content area + Footer. Sidebar is hidden on mobile.

### Affected Files

```
main-app/components/shared/navbar.tsx                → CREATED; sticky top Navbar component
main-app/components/shared/footer.tsx                → CREATED; three-column Footer component
main-app/app/(buyer)/protected/layout.tsx            → MODIFIED; replaced starter template nav with Navbar + Footer shell
main-app/app/(seller)/seller/layout.tsx              → CREATED; seller-specific layout with sidebar navigation
```

### Key Design Decisions

- **Shell components live in `components/shared/`** — `Navbar` and `Footer` are shared primitives, not layout-specific. Any future layout (admin, moderator) can import and reuse them without duplication.
- **Route group layouts handle composition** — Each Next.js route group (`(buyer)`, `(seller)`) owns its own `layout.tsx`. This means the buyer experience and seller portal can diverge independently without touching a shared file.
- **`sticky top-0 z-40` on the Navbar** — Keeps the navigation visible while scrolling through long product listings. `backdrop-blur` with semi-transparent background maintains visual context over page content.
- **Sidebar is data-driven** — The seller sidebar nav items are defined as a plain `sellerNav` array at the top of the layout file. Adding a new seller page requires only a new array entry — no JSX changes needed.
- **`max-w-7xl` content container** — All main content is constrained to 1280px max-width and centered with auto margins. This prevents over-stretched layouts on ultra-wide monitors.
- **Mobile-first** — Sidebar is hidden on mobile (`hidden md:flex`). The navbar collapses its center links on small screens. A full mobile drawer menu is planned for Sprint 3.

### Dependencies & Libraries Used

| Package                             | Purpose                                                                                                                     |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `lucide-react`                      | Icons in Navbar (`ShoppingBag`), Footer (`Github`), Seller sidebar (`LayoutDashboard`, `Package`, `PlusCircle`, `Settings`) |
| `next/link`                         | Client-side navigation links throughout shell                                                                               |
| `next-themes` (via `ThemeSwitcher`) | Theme toggle in Navbar                                                                                                      |
| `@/components/shared/auth-button`   | Supabase-aware auth/logout button in Navbar                                                                                 |
| `@/lib/utils` (`cn`)                | Tailwind class merging in seller sidebar link styles                                                                        |

---

## Section 2 — Modification Guide

### How to Add a New Navigation Link to the Navbar

1. Open `main-app/components/shared/navbar.tsx`.
2. Find the `<nav>` block (the `hidden md:flex` section).
3. Add a new `<Link>` entry following the existing pattern:
   ```tsx
   <Link
     href="/protected/your-new-page"
     className="text-muted-foreground hover:text-foreground transition-colors"
   >
     Your Page
   </Link>
   ```
4. For mobile support, a mobile menu drawer will be needed (Sprint 3 backlog item).

### How to Add a New Seller Sidebar Link

1. Open `main-app/app/(seller)/seller/layout.tsx`.
2. Find the `sellerNav` array at the top of the file:
   ```tsx
   const sellerNav = [
     { href: "/seller", label: "Dashboard", icon: LayoutDashboard },
     // ... existing entries
   ];
   ```
3. Add your new route as a new object:
   ```tsx
   { href: '/seller/analytics', label: 'Analytics', icon: BarChart2 },
   ```
4. Import the icon from `lucide-react` at the top of the file.
5. No other changes needed — the sidebar renders the array automatically.

### How to Create a Layout for a New Route Group

1. Create a new directory in `main-app/app/` using the `(group)` route group syntax, e.g., `(admin)/`.
2. Create a `layout.tsx` inside:

   ```tsx
   import { Navbar } from "@/components/shared/navbar";
   import { Footer } from "@/components/shared/footer";

   export default function AdminLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return (
       <div className="flex min-h-screen flex-col">
         <Navbar />
         <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
           {children}
         </main>
         <Footer />
       </div>
     );
   }
   ```

3. The `(admin)` group won't add a URL segment — routes inside it will still be at `/admin/...`.

### How to Modify the Footer Columns

- Each column in `footer.tsx` is a `<div className="flex flex-col gap-2">` inside the grid.
- To add a column: increase the grid to `md:grid-cols-4` and add a new column `<div>`.
- To add a link to an existing column: add a `<Link>` or `<a>` following the existing pattern.
- The copyright line is at the bottom of the footer, outside the grid.

### Where NOT to Touch

- **`z-40` on the Navbar** — Radix UI modal overlays use `z-50`. Keeping the Navbar at `z-40` ensures dialogs and drawers render above it correctly. Do not increase the Navbar z-index.
- **The `hasEnvVars` guard in `Navbar`** — This guard prevents the auth button from crashing when Supabase env vars are not configured (common in fresh clones). Do not remove it.
- **`main-app/components/shared/auth-button.tsx`** — This is a pre-existing shared component that handles server-side auth state. Do not inline its logic into the Navbar.
- **Route group folder names** — `(buyer)`, `(seller)`, `(auth)`, `(admin)` are Next.js route groups. Renaming them affects all routes inside. Only rename with a full route audit.

### Common Pitfalls

- **Seller sidebar hidden on mobile** — The sidebar uses `hidden md:flex`. On screens smaller than 768px, there is currently no mobile navigation for the seller portal. A mobile drawer needs to be added before the seller portal is released to mobile users.
- **Layout nesting** — In Next.js App Router, layouts nest. The root `app/layout.tsx` wraps everything. The `(buyer)/protected/layout.tsx` adds a second layer. Do not add a third `Navbar` inside a page component — it will double-render.
- **`Suspense` around `AuthButton`** — The `AuthButton` in `Navbar` is wrapped in `<Suspense>`. Do not remove this — it uses `async` server data and will cause a streaming error without it.
- **Footer links use `/protected/` prefix** — Buyer-facing routes live under `/protected/`. If a route is renamed or moved, update the footer links accordingly.

### Testing Checklist

- [ ] Navbar is visible and sticky when scrolling a long page
- [ ] Navbar brand logo links back to `/`
- [ ] Products and Profile links in Navbar navigate correctly
- [ ] ThemeSwitcher in Navbar correctly toggles light/dark mode
- [ ] Auth button shows login/logout state based on session
- [ ] Footer renders in 3 columns on desktop, 1 column on mobile
- [ ] All footer links navigate to the correct routes
- [ ] Seller sidebar renders on `/seller/*` routes (desktop only)
- [ ] Seller sidebar links navigate to correct routes
- [ ] No Navbar or Footer appears on auth pages (`/auth/*` routes)
- [ ] Layout does not shift or flash on page navigation
- [ ] Run `npm run lint` and `npx tsc --noEmit` with no errors
