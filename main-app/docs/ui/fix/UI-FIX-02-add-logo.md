# UI-FIX-02: Add Logo to Navbar

## Implementation Summary

Successfully added CSE327 logo to the navbar as the leftmost element and ensured all pages render within a layout that includes both Navbar and Footer.

---

## Changes Made

### 1. Updated `components/shared/navbar.tsx`

**What changed:**

- Added `Image` import from `next/image`
- Imported logo: `import logo from '@/public/icons/CSE327_Logo_red.jpg'`
- Replaced ShoppingBag icon + "BuySmart" text brand with logo image
- Logo is responsive with `className="object-contain h-8 w-auto md:h-10"` to scale properly on mobile and desktop
- Added `priority` prop to logo for LCP optimization (critical path element)
- Logo sits in a `<Link href="/">` wrapper for navigation to home

**Layout structure preserved:**

- Left: Logo (clickable link to home)
- Center: Nav links (Products, Profile, Settings) - hidden on mobile
- Right: ThemeSwitcher + AuthButton

**Mobile responsiveness:**

- Logo height: `h-8` on mobile, `md:h-10` on medium screens and up
- Width: `w-auto` to maintain aspect ratio
- `flex-shrink-0` prevents logo from being crushed in flex layout

---

### 2. Updated `app/layout.tsx` (Root Layout)

**What changed:**

- Added imports: `import { Navbar } from '@/components/shared/navbar'` and `import { Footer } from '@/components/shared/footer'`
- Wrapped `{children}` with `<Navbar />` and `<Footer />`
- `{children}` wrapped in `<main className="min-h-screen">` to ensure proper spacing and footer positioning

**Layout structure:**

```tsx
<html>
  <body>
    <ThemeProvider>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </ThemeProvider>
  </body>
</html>
```

---

## Logo File Location

**Current location:** `public/icons/CSE327_Logo_red.jpg` ✅

The logo file already existed in the correct public directory structure, so no file movement was needed.

**Why this path works:**

- Next.js serves files from the `public/` directory at the root URL
- Using `import logo from '@/public/icons/CSE327_Logo_red.jpg'` in the component allows Next.js to:
  - Optimize the image (compress, serve in modern formats)
  - Verify the file exists at build time
  - Generate the correct `src` attribute

---

## Layout Strategy Decision

### Chosen Approach: Single Root Layout

**Why:**

1. No route groups have separate layouts (`(buyer)`, `(seller)`, `(admin)`, `(auth)` directories exist but contain no layout.tsx files)
2. All pages should display the same navbar and footer
3. Root layout is the proper place to add components shared across all pages in Next.js App Router

**Alternative approach not needed:**

- Per-route-group layouts would only be necessary if:
  - Admin dashboard needed a different navbar (no public nav)
  - Seller dashboard had unique layout requirements
  - Auth flows needed to hide navbar/footer during login/signup

Currently, the single navbar works for all roles since it uses client-side auth state to conditionally render different buttons (Login/Sign up vs Avatar menu).

---

## Mobile Breakpoint Considerations

### Navbar logo

- **Mobile (`<md`):** Height 32px (h-8), width auto
- **Tablet/Desktop (`≥md`):** Height 40px (md:h-10), width auto
- **Responsive:** Uses Tailwind's responsive prefixes for automatic scaling

### Navbar links visibility

- **Mobile:** Hidden (via `hidden md:flex`)
- **Tablet/Desktop:** Visible in centered nav section

### Container padding

- **Mobile:** `px-4` (1rem)
- **Tablet:** `sm:px-6` (1.5rem)
- **Desktop:** `lg:px-8` (2rem)

---

## Implementation Notes

### Logo Image Best Practices Applied

✅ Used `next/image` component (never raw `<img>`)
✅ Added `priority` prop for LCP optimization
✅ Proper responsive sizing with Tailwind classes
✅ Maintained aspect ratio with `w-auto`
✅ Set explicit height/width for Next.js Image optimization
✅ Used `object-contain` to prevent image distortion

### Preserved All Existing Logic

✅ Auth state handling in Navbar (AuthButton component)
✅ Mobile hamburger menu (nav links use `hidden md:flex`)
✅ Theme switcher functionality
✅ All footer content and links
✅ No refactoring of existing components

### Verification Checklist

- [x] Logo appears on far left of navbar
- [x] Logo is clickable link to home
- [x] Logo scales properly on mobile/tablet/desktop
- [x] All navbar links preserved and functional
- [x] Auth buttons remain on far right
- [x] Footer appears on all pages
- [x] No duplicate navbar/footer rendering
- [x] Root layout feeds all route groups
- [x] Logo file exists at correct path
- [x] Image component uses `priority` for LCP

---

## Files Modified

1. **components/shared/navbar.tsx** — Added logo image, removed ShoppingBag icon + text
2. **app/layout.tsx** — Wrapped children with Navbar and Footer components

## Files Created

None — All necessary files already existed.

---

## Next Steps (Optional)

If the current navbar setup changes in the future:

1. If admin needs different navbar → Create `app/(admin)/layout.tsx` with custom layout
2. If seller needs different navbar → Create `app/(seller)/layout.tsx` with custom layout
3. If auth flows need to hide navbar → Create `app/(auth)/layout.tsx` without Navbar/Footer

For now, single root layout is optimal since all roles use the same navbar with conditional rendering.
