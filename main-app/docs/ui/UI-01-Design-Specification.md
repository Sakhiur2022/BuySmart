# BuySmart Design System

## 1️⃣ UI FOUNDATION (Production-Oriented)

### 🎨 Color System

#### Primary Brand Palette

- **Primary Red**: HSL(350, 84%, 60%) | HEX: #E63946 | RGB: 230, 57, 70
- **Secondary Gray**: HSL(0, 0%, 96%) | HEX: #F5F5F5 | RGB: 245, 245, 245
- **Accent Blue**: HSL(210, 100%, 56%) | HEX: #007BFF | RGB: 0, 123, 255
- **Destructive Red**: HSL(0, 84%, 60%) | HEX: #DC3545 | RGB: 220, 53, 69
- **Success Green**: HSL(120, 61%, 40%) | HEX: #28A745 | RGB: 40, 167, 69
- **Warning Yellow**: HSL(45, 100%, 51%) | HEX: #FFC107 | RGB: 255, 193, 7

#### Neutral Grayscale Scale

- **50**: HSL(0, 0%, 98%) | HEX: #FAFAFA
- **100**: HSL(0, 0%, 96%) | HEX: #F5F5F5
- **200**: HSL(0, 0%, 90%) | HEX: #E5E5E5
- **300**: HSL(0, 0%, 80%) | HEX: #CCCCCC
- **400**: HSL(0, 0%, 70%) | HEX: #B3B3B3
- **500**: HSL(0, 0%, 60%) | HEX: #999999
- **600**: HSL(0, 0%, 50%) | HEX: #808080
- **700**: HSL(0, 0%, 40%) | HEX: #666666
- **800**: HSL(0, 0%, 30%) | HEX: #4D4D4D
- **900**: HSL(0, 0%, 20%) | HEX: #333333
- **950**: HSL(0, 0%, 10%) | HEX: #1A1A1A

#### Semantic Colors

- **Success**: HSL(120, 61%, 40%) | HEX: #28A745
- **Warning**: HSL(45, 100%, 51%) | HEX: #FFC107
- **Destructive**: HSL(0, 84%, 60%) | HEX: #DC3545
- **Info**: HSL(210, 100%, 56%) | HEX: #007BFF

#### AI-State Colors

- **Thinking**: HSL(210, 100%, 56%) | HEX: #007BFF
- **Generating**: HSL(45, 100%, 51%) | HEX: #FFC107
- **Recommending**: HSL(120, 61%, 40%) | HEX: #28A745

#### Dark Mode Equivalents

- **Primary Red**: HSL(350, 84%, 70%) | HEX: #FF6B6B
- **Background**: HSL(0, 0%, 10%) | HEX: #1A1A1A
- **Foreground**: HSL(0, 0%, 90%) | HEX: #E5E5E5

#### WCAG AA Contrast Validation

All colors meet WCAG AA contrast standards for text and UI elements.

#### Tailwind-Ready Color Naming Convention

```js
colors: {
  primary: "hsl(350, 84%, 60%)",
  secondary: "hsl(0, 0%, 96%)",
  accent: "hsl(210, 100%, 56%)",
  destructive: "hsl(0, 84%, 60%)",
  success: "hsl(120, 61%, 40%)",
  warning: "hsl(45, 100%, 51%)",
  info: "hsl(210, 100%, 56%)",
  neutral: {
    50: "hsl(0, 0%, 98%)",
    100: "hsl(0, 0%, 96%)",
    200: "hsl(0, 0%, 90%)",
    300: "hsl(0, 0%, 80%)",
    400: "hsl(0, 0%, 70%)",
    500: "hsl(0, 0%, 60%)",
    600: "hsl(0, 0%, 50%)",
    700: "hsl(0, 0%, 40%)",
    800: "hsl(0, 0%, 30%)",
    900: "hsl(0, 0%, 20%)",
    950: "hsl(0, 0%, 10%)",
  },
},
```

#### CSS Variable Structure for Theme Switching

```css
:root {
  --primary: hsl(350, 84%, 60%);
  --secondary: hsl(0, 0%, 96%);
  --accent: hsl(210, 100%, 56%);
  --destructive: hsl(0, 84%, 60%);
  --success: hsl(120, 61%, 40%);
  --warning: hsl(45, 100%, 51%);
  --info: hsl(210, 100%, 56%);
  --neutral-50: hsl(0, 0%, 98%);
  --neutral-100: hsl(0, 0%, 96%);
  --neutral-200: hsl(0, 0%, 90%);
  --neutral-300: hsl(0, 0%, 80%);
  --neutral-400: hsl(0, 0%, 70%);
  --neutral-500: hsl(0, 0%, 60%);
  --neutral-600: hsl(0, 0%, 50%);
  --neutral-700: hsl(0, 0%, 40%);
  --neutral-800: hsl(0, 0%, 30%);
  --neutral-900: hsl(0, 0%, 20%);
  --neutral-950: hsl(0, 0%, 10%);
}

.dark {
  --primary: hsl(350, 84%, 70%);
  --background: hsl(0, 0%, 10%);
  --foreground: hsl(0, 0%, 90%);
}
```

#### Usage Guidelines

- **Primary Red**: Use for call-to-action buttons, links, and highlights.
- **Secondary Gray**: Use for backgrounds and subtle UI elements.
- **Accent Blue**: Use for interactive elements like links and AI states.
- **Destructive Red**: Use for error messages and destructive actions.
- **Success Green**: Use for success messages and confirmations.
- **Warning Yellow**: Use for warnings and alerts.

#### Anti-Pattern Examples

- **Avoid** using too many colors in a single component.
- **Avoid** low-contrast combinations like `muted` on `background`.

---

### 🔤 Typography System

#### Primary Font

- **Font**: Geist Sans (Google Fonts)
- **Fallback Stack**: `"Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

#### Type Scale

| Role           | Desktop | Tablet | Mobile |
| -------------- | ------- | ------ | ------ |
| **Display**    | 64px    | 48px   | 36px   |
| **H1**         | 48px    | 36px   | 28px   |
| **H2**         | 36px    | 28px   | 24px   |
| **H3**         | 28px    | 24px   | 20px   |
| **H4**         | 24px    | 20px   | 18px   |
| **H5**         | 20px    | 18px   | 16px   |
| **H6**         | 18px    | 16px   | 14px   |
| **Body**       | 16px    | 14px   | 14px   |
| **Small Text** | 14px    | 12px   | 12px   |
| **Button**     | 16px    | 14px   | 14px   |
| **Label**      | 14px    | 12px   | 12px   |

#### Line Height + Tracking

- **Line Height**: 1.5
- **Tracking**: Normal

#### Tailwind Config Integration Example

```js
extend: {
  fontFamily: {
    sans: ["Geist Sans", "sans-serif"],
  },
  fontSize: {
    display: ["64px", { lineHeight: "1.2" }],
    h1: ["48px", { lineHeight: "1.2" }],
    body: ["16px", { lineHeight: "1.5" }],
  },
}
```

#### Accessibility Minimum Size Rules

- **Body Text**: Minimum 14px
- **Button Text**: Minimum 14px
- **Label Text**: Minimum 12px

---

### 📐 Layout & Grid System

#### 12-Column Responsive Grid

- **Container Max Widths**:
  - Mobile: 640px
  - Tablet: 768px
  - Desktop: 1024px
  - Wide: 1280px

#### Breakpoints

- **Mobile**: `sm`
- **Tablet**: `md`
- **Desktop**: `lg`
- **Wide**: `xl`

#### Dashboard Layout Structure

- **Sidebar**: Collapsible, 240px wide
- **Header**: Fixed, 64px tall
- **Content Area**: Fluid width

#### Auth Layout Structure

- **Centered Form**: Max width 400px, vertical padding 48px

#### Marketplace Layout Structure

- **Grid**: 3-column layout for products, 1-column for filters

#### Safe Spacing Rules

- **Padding**: 16px (mobile), 24px (tablet), 32px (desktop)
- **Gap**: 8px, 16px, 24px

#### Fixed vs Fluid Containers

- **Fixed**: Use for forms, modals, and dashboards.
- **Fluid**: Use for marketplace grids and content-heavy pages.

#### Nested Layouts in Next.js App Router

- Use `layout.tsx` for shared headers/footers.
- Use `page.tsx` for page-specific content.

---

### 📏 Spacing & Elevation

#### 8px Spacing Scale

- **Base Unit**: 8px
- **Multiples**: 4px, 8px, 16px, 24px, 32px, 40px, 48px

#### Border Radius Scale

- **Small**: 4px
- **Medium**: 8px
- **Large**: 16px
- **Extra Large**: 24px
- **Full**: 9999px

#### Shadow Scale

- **Small**: `0 1px 2px rgba(0, 0, 0, 0.05)`
- **Medium**: `0 4px 6px rgba(0, 0, 0, 0.1)`
- **Large**: `0 10px 15px rgba(0, 0, 0, 0.15)`
- **Extra Large**: `0 20px 25px rgba(0, 0, 0, 0.2)`

#### Elevation Usage Rules

- **Cards**: Use `shadow-sm`
- **Modals**: Use `shadow-lg`
- **Dropdowns**: Use `shadow-md`
