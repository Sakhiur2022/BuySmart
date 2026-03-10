# UI-01 — Reusable UI Component Library

**Sprint:** 2 | **Status:** ✅ Complete | **Owner:** ASR

---

## Section 1 — Implementation Summary

### Overview

UI-01 establishes the foundational component library for the BuySmart frontend. All primitive UI elements are built on top of [shadcn/ui](https://ui.shadcn.com/) conventions using Radix UI headless primitives, styled with Tailwind CSS and the `class-variance-authority` (CVA) pattern. This library is the shared building block consumed by every page, layout, and feature in the application.

### What Was Built

**Pre-existing components (from project scaffold):**

- `Button` — Primary interaction element with `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` variants and multiple sizes
- `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` — Composable card layout primitives
- `Input` — Styled text input with focus ring and disabled state
- `Label` — Accessible form label bound to Radix Label primitive
- `Checkbox` — Accessible checkbox via Radix Checkbox
- `Badge` — Inline status/category tag with variant support
- `DropdownMenu` — Full Radix Dropdown Menu implementation with sub-menus, separators, and keyboard navigation

**New components added in UI-01 (Sprint 2):**

- `Dialog` — Modal overlay built on Radix Dialog with animated enter/exit, close button, portal rendering, and composable sub-components
- `Select` — Accessible single-select dropdown built on Radix Select with scroll buttons, item indicators, and popper positioning
- `Textarea` — Multi-line text input styled consistently with `Input`
- `Separator` — Horizontal/vertical visual divider via Radix Separator
- `Avatar` / `AvatarImage` / `AvatarFallback` — User avatar display with image and initials fallback, built on Radix Avatar
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` — Accessible tabbed content panels via Radix Tabs

### Affected Files

```
main-app/components/ui/button.tsx          → Pre-existing; CVA-based Button with 6 variants and 8 sizes
main-app/components/ui/card.tsx            → Pre-existing; composable Card layout (6 sub-components)
main-app/components/ui/input.tsx           → Pre-existing; single-line styled text input
main-app/components/ui/label.tsx           → Pre-existing; Radix Label wrapper
main-app/components/ui/checkbox.tsx        → Pre-existing; Radix Checkbox with check icon
main-app/components/ui/badge.tsx           → Pre-existing; inline tag/status badge
main-app/components/ui/dropdown-menu.tsx   → Pre-existing; full Radix DropdownMenu
main-app/components/ui/dialog.tsx          → CREATED; modal dialog with portal, overlay, animations
main-app/components/ui/select.tsx          → CREATED; accessible select dropdown with scroll buttons
main-app/components/ui/textarea.tsx        → CREATED; multi-line styled textarea
main-app/components/ui/separator.tsx       → CREATED; horizontal/vertical divider
main-app/components/ui/avatar.tsx          → CREATED; avatar with image + text fallback
main-app/components/ui/tabs.tsx            → CREATED; accessible tabbed panels
```

### Key Design Decisions

- **Radix UI as the headless primitive layer** — All interactive components (`Dialog`, `Select`, `Tabs`, `Checkbox`, etc.) use Radix primitives. This gives us accessibility (ARIA roles, keyboard navigation, focus management) for free without building it ourselves.
- **CVA for variant management** — `Button` and `Badge` use `class-variance-authority` so variants and sizes are declared as data, not repeated Tailwind strings. New components should follow this pattern if they have multiple visual states.
- **CSS variable-based theming** — All colors reference Tailwind CSS variables (`bg-background`, `text-foreground`, `ring-ring`, etc.) defined in `globals.css`. This enables light/dark mode switching without component changes.
- **`'use client'` only where needed** — Components that use Radix interactive hooks (Dialog, Select, Tabs, Avatar) are marked `'use client'`. Static display components (Separator, Textarea, Card) are server-safe.
- **No custom design tokens** — The component library deliberately stays within the shadcn/ui design token set to remain consistent with the rest of the project and avoid design drift.

### Dependencies & Libraries Used

| Package                         | Purpose                                   |
| :------------------------------ | :---------------------------------------- |
| `radix-ui` (bundled)            | Slot, existing primitives                 |
| `@radix-ui/react-dialog`        | Dialog/Modal primitive                    |
| `@radix-ui/react-select`        | Select dropdown primitive                 |
| `@radix-ui/react-avatar`        | Avatar with fallback primitive            |
| `@radix-ui/react-separator`     | Separator primitive                       |
| `@radix-ui/react-tabs`          | Tabs primitive                            |
| `@radix-ui/react-checkbox`      | Checkbox primitive (pre-existing)         |
| `@radix-ui/react-label`         | Label primitive (pre-existing)            |
| `@radix-ui/react-dropdown-menu` | Dropdown primitive (pre-existing)         |
| `class-variance-authority`      | Variant-based class management            |
| `lucide-react`                  | Icons (X close, Check, ChevronDown, etc.) |
| `clsx` + `tailwind-merge`       | Utility: `cn()` helper in `lib/utils.ts`  |

---

## Section 2 — Modification Guide

### How to Add a New Component

1. **Create the file** at `main-app/components/ui/<component-name>.tsx`.
2. **Choose your base:** Use a Radix primitive if the component is interactive (needs focus, keyboard nav, ARIA). Use a plain HTML element for display-only components.
3. **Follow the naming convention** — named function exports, no default exports:

   ```tsx
   // ✅ Correct
   export { MyComponent };

   // ❌ Avoid
   export default function MyComponent() {}
   ```

4. **Use the `cn()` utility** for merging Tailwind classes:

   ```tsx
   import { cn } from "@/lib/utils";

   function MyComponent({ className, ...props }: React.ComponentProps<"div">) {
     return <div className={cn("base-classes", className)} {...props} />;
   }
   ```

5. **Use CVA for variants** if the component has more than one visual state:

   ```tsx
   import { cva, type VariantProps } from "class-variance-authority";

   const myVariants = cva("base-class", {
     variants: {
       variant: { default: "bg-primary", secondary: "bg-secondary" },
     },
     defaultVariants: { variant: "default" },
   });
   ```

6. **Add `'use client'` only if the component uses hooks or Radix interactive primitives.**
7. **Install the Radix package** if needed:
   ```bash
   npm install @radix-ui/react-<primitive-name>
   ```

### How to Modify Existing Styles or Behavior

| What you want to change    | Where to look                                                     |
| :------------------------- | :---------------------------------------------------------------- |
| Button variants or sizes   | `buttonVariants` in `components/ui/button.tsx`                    |
| Dialog animation speed     | `duration-200` class on `DialogPrimitive.Content` in `dialog.tsx` |
| Select dropdown max height | `max-h-96` class on `SelectPrimitive.Content` in `select.tsx`     |
| Avatar size                | Pass `className="h-12 w-12"` (or any size) to `<Avatar>`          |
| Tabs active state style    | `data-[state=active]:` classes in `TabsTrigger` in `tabs.tsx`     |
| Global color tokens        | CSS variables in `app/globals.css`                                |
| Separator thickness        | `h-[1px]` / `w-[1px]` in `separator.tsx`                          |

### Where NOT to Touch

- **`lib/utils.ts`** — The `cn()` function is a shared utility. Do not add component-specific logic here.
- **Radix primitive props** — Do not strip `...props` spreads from component wrappers; they are needed for accessibility attributes (`aria-*`, `data-*`) passed by Radix internally.
- **CSS variable names** — Do not rename tokens like `--background`, `--foreground`, `--primary` in `globals.css`. Every component depends on them.
- **The `asChild` pattern on `Button`** — This enables composing `Button` with `Link` (`<Button asChild><Link href="/">Go</Link></Button>`). Do not remove the Slot integration.

### Common Pitfalls

- **Forgetting `'use client'`** on Radix interactive components will cause a Next.js server component error. If a component uses `useState`, event handlers, or a Radix primitive that manages state, it must be a client component.
- **Importing from the wrong path** — Always use the `@/components/ui/` alias, never relative paths like `../../components/ui/button`.
- **Tailwind classes not applying** — Make sure the file is inside a directory covered by Tailwind's `content` glob in `tailwind.config`. All files under `main-app/**/*.tsx` are already covered.
- **Dialog not closing** — Ensure `DialogClose` or `onOpenChange` is wired correctly. The close `X` button in `DialogContent` only closes if `DialogPrimitive.Root` controls the `open` state.
- **Select value not updating** — `Select` is a controlled/uncontrolled component. If you pass `value`, you must also pass `onValueChange`.

### Testing Checklist

- [ ] `Button` renders in all 6 variants without console errors
- [ ] `Dialog` opens on trigger click, closes on `X` button, closes on `Escape` key and overlay click
- [ ] `Select` opens dropdown, allows keyboard navigation, fires `onValueChange` on selection
- [ ] `Tabs` switches content panel on trigger click and supports keyboard arrow navigation
- [ ] `Avatar` shows image when `src` is valid; shows fallback text when image fails or `src` is omitted
- [ ] `Separator` renders horizontally by default; renders vertically when `orientation="vertical"`
- [ ] All components render correctly in both light and dark mode
- [ ] No TypeScript errors: run `npx tsc --noEmit` from `main-app/`
- [ ] No lint errors: run `npm run lint` from `main-app/`
