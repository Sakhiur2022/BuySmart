# PROD-04: Category Management

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-2  
**Last Updated:** March 2026

---

## Overview

PROD-04 implements a hierarchical category management system for the BuySmart marketplace. The feature enables:

- **Admin users** to create, edit, and deactivate product categories with parent-child relationships
- **Sellers** to select from active categories when listing products
- **Automatic level computation** for nested category hierarchies
- **Soft-delete protection** to prevent deactivation of categories with active products
- **Shared admin dashboard** for both admin and moderator roles with role-based access control

The implementation enforces a **layered architecture pattern** with security checks at the server action, controller, service, and database layers.

---

## User Stories Covered

| Story ID | Title                                    | Status         |
| -------- | ---------------------------------------- | -------------- |
| US-XX    | Admin can create product categories      | ✅ Implemented |
| US-XX    | Admin can edit category details          | ✅ Implemented |
| US-XX    | Admin can deactivate categories          | ✅ Implemented |
| US-XX    | Sellers can select category for products | ✅ Implemented |
| US-XX    | Categories display hierarchically        | ✅ Implemented |

---

## Database Schema

### categories Table

```sql
create table if not exists categories (
  category_id         bigserial primary key,
  name                varchar(100) not null,
  description         text,
  parent_category_id  bigint references categories(category_id)
                        on delete set null,
  level               int,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (name, parent_category_id)
);
```

**Column Details:**

| Column               | Type           | Constraint             | Description                                                                          |
| -------------------- | -------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `category_id`        | `bigserial`    | PRIMARY KEY            | Auto-incrementing unique identifier. Maps to TypeScript `number`, not `uuid`         |
| `name`               | `varchar(100)` | NOT NULL               | Category display name, max 100 chars                                                 |
| `description`        | `text`         | nullable               | Optional category description                                                        |
| `parent_category_id` | `bigint`       | FK, nullable           | Reference to parent category. `NULL` indicates root category                         |
| `level`              | `int`          | nullable               | Hierarchical depth: 0 = root, 1 = child of root, etc. Auto-computed by service layer |
| `is_active`          | `boolean`      | NOT NULL, default true | Soft-delete flag. Deactivated categories hidden from sellers                         |
| `created_at`         | `timestamptz`  | NOT NULL, def now()    | Timestamp of record creation                                                         |
| `updated_at`         | `timestamptz`  | NOT NULL, def now()    | Timestamp of last modification                                                       |

**Compound Unique Index:**

```sql
unique (name, parent_category_id)
```

Enforces that each parent can have only one child with a given name. Root categories (parent_category_id = NULL) must also have unique names globally.

### RLS Policies

```sql
-- Public read access (all authenticated users)
create policy "categories_public_read" on categories
  for select
  using (true);

-- Admin write access (insert, update, delete)
-- Note: soft-delete (is_active = false) is considered an update, not a delete
create policy "categories_admin_write" on categories
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
```

**Security Model:**

- All authenticated users can **read** all categories (both active and inactive)
- Only users with role='admin' can **insert**, **update**, or **delete** categories
- The `is_admin()` function is called server-side; RLS is enforced at the database layer as the second security boundary
- The primary security enforcement is at the application layer (server actions, controllers); the DB is a safety net

### DB Helper Functions

**Existing function (used elsewhere in system):**

```sql
create or replace function is_admin(user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from users_profile up
    where up.user_id = $1
      and up.role = 'admin'
      and up.is_active = true
  );
$$;
```

**New functions added in PROD-04 migrations:**

```sql
create or replace function is_admin_or_moderator(user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from users_profile up
    where up.user_id = $1
      and up.role in ('admin', 'moderator')
      and up.is_active = true
  );
$$;
```

This function is used by RLS policies on non-category tables (feedback, refunds, products, users_profile, activity_logs) to grant moderators the same access as admins to their respective data.

### Migration Files

**File:** `supabase/migrations/YYYYMMDDHHMMSS_admin_moderator_rls_policies.sql`

This migration:

1. Creates the `categories` table with schema above
2. Adds RLS policies for `categories` (public read, admin write)
3. Adds RLS policies for `products` (moderator can set status to inactive)
4. Adds RLS policies for `feedback` (moderator can mark flagged/resolved)
5. Adds RLS policies for `refunds` (moderator can update status)
6. Adds RLS policies for `users_profile` (moderator can suspend/unsuspend)
7. Adds RLS policies for `activity_logs` (moderator can insert and read scoped logs)
8. Creates the `is_admin_or_moderator()` helper function

---

## TypeScript Models

### Category Model

**File:** `lib/models/category.model.ts`

```typescript
/**
 * Represents a product category in the BuySmart catalog.
 *
 * IMPORTANT: category_id is a BigSerial (number), NOT a uuid string.
 * This is different from other entity IDs in the system.
 */
export interface Category {
  category_id: number; // BigSerial from PostgreSQL
  name: string;
  description: string | null;
  parent_category_id: number | null; // null for root categories
  level: number | null; // 0 for root, 1 for children, etc.
  is_active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Input type for creating a new category.
 * Used by CreateCategorySchema (Zod).
 */
export type CreateCategoryInput = Pick<
  Category,
  'name' | 'description' | 'parent_category_id' | 'level'
>;

/**
 * Input type for updating an existing category.
 * All fields optional. level is typically not changed by clients;
 * it is auto-computed by the service layer.
 */
export type UpdateCategoryInput = Partial<CreateCategoryInput> & {
  is_active?: boolean;
};
```

**TypeScript → PostgreSQL Type Mapping:**

- `number` ↔ `bigserial` / `bigint`
- `string` ↔ `varchar` / `text`
- `boolean` ↔ `boolean`
- `string | null` (ISO 8601) ↔ `timestamptz`

**Critical Note:** Unlike users, orders, and other entities that use UUID primary keys (`uuid` type), categories use `bigserial`. When storing a `category_id` on a product or in client state, it must remain a `number`. Common mistake: casting to `string` and later forgetting to parse back to `number`.

---

## Architecture & Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request (Server-Side Render or Form Submit)           │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                ┌─────────────────▼──────────────────┐
                │  Next.js Page (RSC) or            │
                │  Client Component with             │
                │  Form for category mutation        │
                └─────────────────┬──────────────────┘
                                  │
                ┌─────────────────▼──────────────────────┐
                │  Server Action                         │
                │  (lib/actions/category.actions.ts)    │
                │                                       │
                │  - 'use server' directive             │
                │  - Session extraction                 │
                │  - User role verification from DB     │
                │  - Zod input validation               │
                │  - Discriminated union result:        │
                │    { success: true; data: ... }       │
                │    { success: false; error: string }  │
                └─────────────────┬──────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────┐
                │  Controller                            │
                │  (lib/controllers/category.controller)│
                │                                       │
                │  - Orchestrates service calls        │
                │  - Handles response transformation   │
                │  - Throws errors for server action  │
                └─────────────────┬──────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────┐
                │  Service Layer                         │
                │  (lib/services/category.service.ts)   │
                │                                       │
                │  - Business rules enforcement         │
                │  - Level auto-computation             │
                │  - Uniqueness validation              │
                │  - Soft-delete guards                 │
                │  - Throws domain-specific errors      │
                └─────────────────┬──────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────┐
                │  Repository Layer                      │
                │  (lib/repositories/                    │
                │   category.repository.ts)             │
                │                                       │
                │  - Supabase client initialization     │
                │  - Pure DB queries (findOne, insert, │
                │    update, delete, exists checks)     │
                │  - No business logic                  │
                └─────────────────┬──────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────┐
                │  Supabase PostgreSQL                   │
                │  (with RLS policies enforced)         │
                │                                       │
                │  [categories table]                   │
                │  RLS: is_admin(auth.uid())            │
                └─────────────────────────────────────────┘
```

**Why Layered?**

- **Server Action:** Validates user session and input
- **Controller:** Stateless orchestration (easy to test)
- **Service:** Encapsulates all business logic (can be reused by APIs, CLI, etc.)
- **Repository:** Decouples logic from storage details (can swap Supabase for another DB)
- **Database:** Final enforcement boundary with RLS

---

## File Structure Map

### New Files Created

```
supabase/migrations/
  └─ YYYYMMDDHHMMSS_admin_moderator_rls_policies.sql
       ├─ Creates categories table
       ├─ Creates RLS policies (categories, products, feedback, refunds, users_profile, activity_logs)
       └─ Creates is_admin_or_moderator() function

lib/types/
  └─ admin.types.ts
       ├─ AdminRole type ('admin' | 'moderator')
       ├─ AdminSection union type (9 sections)
       ├─ PERMISSIONS map (section → allowed roles)
       └─ canAccess(role, section) function

lib/models/
  └─ category.model.ts
       ├─ Category interface
       ├─ CreateCategoryInput type
       └─ UpdateCategoryInput type

lib/repositories/
  └─ category.repository.ts
       ├─ findAll(client): Promise<Category[]>
       ├─ findAllActive(client): Promise<Category[]>
       ├─ findById(client, id): Promise<Category | null>
       ├─ create(client, input): Promise<Category>
       ├─ update(client, id, input): Promise<Category>
       ├─ softDelete(client, id): Promise<void>
       └─ nameExistsUnderParent(client, name, parentId): Promise<boolean>

lib/services/
  └─ category.service.ts
       ├─ Business rule: auto-compute level from parent
       ├─ Business rule: validate title uniqueness under parent
       ├─ Business rule: prevent soft-delete if active products exist
       ├─ Business rule: validate parent_category_id exists (if provided)
       └─ Throws domain-specific errors (CategoryNotFound, CategoryNotEmpty, etc.)

lib/controllers/
  └─ category.controller.ts
       ├─ getAllCategories(): Promise<Category[]>
       ├─ getActiveCategories(): Promise<Category[]>
       ├─ getCategoryById(id): Promise<Category>
       ├─ createCategory(input): Promise<Category>
       ├─ updateCategory(id, input): Promise<Category>
       └─ softDeleteCategory(id): Promise<void>

lib/actions/
  └─ category.actions.ts
       ├─ createCategoryAction(input): Promise<{ success, data|error }>
       ├─ updateCategoryAction(id, input): Promise<{ success, data|error }>
       └─ softDeleteCategoryAction(id): Promise<{ success, error? }>

app/(admin)/
  ├─ layout.tsx
  │    ├─ Session + role verification
  │    ├─ Redirect unauthenticated users to /auth/login
  │    ├─ Redirect non-admin/moderator users to /
  │    ├─ Check is_active = true (suspend guard)
  │    └─ Provide AdminUserContext to children
  │
  └─ admin/
       ├─ page.tsx
       │    ├─ Fetch dashboard stats filtered by role
       │    └─ Render stat cards grid
       │
       └─ categories/
            ├─ page.tsx
            │    ├─ Admin-only section guard: redirect if !canAccess(role, 'categories')
            │    ├─ Fetch all categories (active + inactive)
            │    ├─ Render category table with search/filter
            │    └─ Render create, edit, delete dialogs
            │
            ├─ components/
            │    ├─ category-table.tsx
            │    │    ├─ DataTable with columns: name, parent, level, status, actions
            │    │    ├─ Search by name
            │    │    └─ Filter by level or parent
            │    │
            │    ├─ category-form-dialog.tsx
            │    │    ├─ Shared modal for create + edit
            │    │    ├─ <Form> with fields: name, description, parent, level (read-only)
            │    │    ├─ Parent dropdown: select from all root categories
            │    │    └─ Call createCategoryAction or updateCategoryAction on submit
            │    │
            │    └─ category-delete-dialog.tsx
            │         ├─ AlertDialog for deactivation
            │         ├─ Display warning: "Deactivating will hide from sellers"
            │         └─ Call softDeleteCategoryAction on confirm
            │
            └─ feedback/ (moderator accessible)
            └─ refunds/ (moderator accessible)
            └─ products/ (moderator accessible)
            └─ users/ (moderator accessible)
            └─ ai-configs/ (admin only)
            └─ logs/ (admin only)

components/admin/
  ├─ admin-shell.tsx
  │    ├─ Layout wrapper for all admin pages
  │    ├─ Provides AdminUserContext (role, user_id, name)
  │    ├─ Renders <AdminSidebar> + <main>
  │    └─ Handles mobile responsiveness
  │
  ├─ admin-sidebar.tsx
  │    ├─ Navigation panel with role-aware section links
  │    ├─ Shows/hides sections based on canAccess()
  │    ├─ Mobile: Sheet drawer that collapses on nav click
  │    └─ Links to each admin section
  │
  ├─ stat-card.tsx
  │    ├─ Reusable card component
  │    ├─ Props: label, value, trend, icon
  │    └─ Used on dashboard home for metrics
  │
  └─ categories/
       ├─ category-table.tsx
       ├─ category-form-dialog.tsx
       └─ category-delete-dialog.tsx

components/shared/
  └─ navbar.tsx (MODIFIED)
       ├─ Conditionally show "Admin Dashboard" link
       ├─ Visible only if: profile?.role in ['admin', 'moderator']
       └─ Security note: visibility is UI only; real guard is in layout.tsx
```

### Modified Files

| File                                                     | Changes                                                                                               | Reason                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `app/(seller)/seller/products/new/page.tsx`              | Category dropdown now fetches from `getActiveCategories()` controller; stores `category_id` as number | Drive category selection from DB; enable admin to manage available options dynamically |
| `app/(seller)/seller/products/[productId]/edit/page.tsx` | Same category dropdown update                                                                         | Consistency with new product form                                                      |
| `components/shared/navbar.tsx`                           | Add conditional "Admin Dashboard" link visible for admin + moderator roles                            | Easy admin access from top nav                                                         |
| `middleware.ts`                                          | (if exists) Ensure /admin routes checked for role (admin \| moderator)                                | Double-guard: middleware + layout                                                      |

---

## Admin Dashboard

### Access Control Design

**Decision:** Both `admin` and `moderator` roles share the `/admin` route group. Individual sections are gated using a role-based access control helper.

**Rationale:**

- Admins and moderators work on overlapping data (feedback, refunds, products, users)
- Separate route groups would require duplicating the layout shell
- A unified dashboard provides a consistent UX; role differences are felt at the section level
- New moderator roles can be quickly added by updating the PERMISSIONS map

### Permission Definitions

**File:** `lib/types/admin.types.ts`

```typescript
export type AdminRole = 'admin' | 'moderator';

export type AdminSection =
  | 'dashboard'
  | 'categories'
  | 'ai_configs'
  | 'activity_logs'
  | 'user_management'
  | 'feedback_moderation'
  | 'refund_management'
  | 'product_moderation'
  | 'user_moderation';

const PERMISSIONS: Record<AdminSection, AdminRole[]> = {
  dashboard: ['admin', 'moderator'],
  feedback_moderation: ['admin', 'moderator'],
  refund_management: ['admin', 'moderator'],
  product_moderation: ['admin', 'moderator'],
  user_moderation: ['admin', 'moderator'],
  categories: ['admin'],
  ai_configs: ['admin'],
  activity_logs: ['admin'],
  user_management: ['admin'],
};

export function canAccess(role: AdminRole, section: AdminSection): boolean {
  return PERMISSIONS[section].includes(role);
}
```

### Permission Matrix

| Section                 | Admin | Moderator | Purpose                                                   |
| ----------------------- | :---: | :-------: | --------------------------------------------------------- |
| **Dashboard**           |  ✅   |    ✅     | Home with scoped stats                                    |
| **Feedback Moderation** |  ✅   |    ✅     | Review flagged feedback, mark resolved                    |
| **Refund Management**   |  ✅   |    ✅     | Review refund requests, approve/deny                      |
| **Product Moderation**  |  ✅   |    ✅     | Review flagged products, set to inactive                  |
| **User Moderation**     |  ✅   |    ✅     | Warn or suspend users                                     |
| **Category Management** |  ✅   |    ❌     | System-level config; restricted to admins                 |
| **AI Settings**         |  ✅   |    ❌     | AI model configs; restricted to admins                    |
| **Activity Logs**       |  ✅   |    ❌     | System audit trail; restricted to admins                  |
| **User Management**     |  ✅   |    ❌     | Role assignment, user profile edits; restricted to admins |

### Navbar Conditional Visibility

**Pattern:** The main application navbar (visible to all logged-in users) conditionally displays the "Admin Dashboard" link only for users with role `admin` or `moderator`.

**Implementation Location:** `components/shared/navbar.tsx`

```typescript
// Server-side check during navbar render
const { data: { session } } = await supabase.auth.getSession();
const profile = session
  ? await getProfile(session.user.id)  // fetches users_profile row
  : null;

const showAdminLink =
  profile?.role === 'admin' || profile?.role === 'moderator';

// In JSX
{showAdminLink && (
  <Link href="/admin" className="inline-flex items-center gap-2">
    <Shield className="w-4 h-4" />
    Admin Dashboard
  </Link>
)}
```

**Security Caveat:** ⚠️ **Hiding the navbar link is UI convenience only.** It is NOT a security mechanism. The actual security enforcement happens in `app/(admin)/layout.tsx` which verifies the user's role and `is_active` status on every request. A determined attacker can directly navigate to `/admin` and will be blocked by the layout guard. **Never rely on hiding navigation as a security boundary.**

### Layout Auth Guard

**File:** `app/(admin)/layout.tsx`

The layout implements a multi-step guard that executes on every request to any `/admin/*` route:

```
Step 1: Extract session from Supabase SSR
        → No session? redirect('/auth/login')

Step 2: Fetch users_profile where user_id = session.user.id
        → Profile not found? redirect('/auth/login')

Step 3: Check role IS IN ('admin', 'moderator')
        → Role is 'buyer' or 'seller'? redirect('/')

Step 4: Check is_active = true
        → User is suspended (is_active = false)? redirect('/auth/login')

Step 5: Build AdminUser object
        → Pass to <AdminShell> as context prop
        → AdminShell provides AdminUserContext
        → Deep client components can useContext(AdminUserContext)
```

**TypeScript:**

```typescript
interface AdminUser {
  user_id: string;
  email: string;
  role: 'admin' | 'moderator';
  name: string | null;
  is_active: boolean;
}
```

**Double-Guard Pattern (Admin-Only Pages):**

Pages or sections under `/admin` that are **admin-only** (not accessible to moderators) implement a second, client-side or page-level guard:

```typescript
// app/(admin)/admin/categories/page.tsx
export default async function CategoriesPage() {
  const adminUser = await getAdminUserFromSession();

  // First guard (already passed in layout, but belt-and-suspenders)
  if (!adminUser || adminUser.role !== 'admin') {
    notFound(); // ← Use notFound() here, not redirect()
  }

  // Render admin-only content
}
```

**Why `notFound()` not `redirect()`?** Using `redirect()` would signal to an unauthorized user that the route exists. Using `notFound()` treats the route as if it doesn't exist, leaking no information about the URL structure to unauthorized users. Redirect is used in the layout for role/auth issues; notFound is used inside admin-only pages.

### Dashboard Stats

**Admin Dashboard Stats:**

| Stat                 | Query                                                                           | Visible To       |
| -------------------- | ------------------------------------------------------------------------------- | ---------------- |
| **Total Users**      | `SELECT count(*) FROM users_profile`                                            | Admin            |
| **Total Products**   | `SELECT count(*) FROM products`                                                 | Admin            |
| **Total Orders**     | `SELECT count(*) FROM orders`                                                   | Admin            |
| **Total Revenue**    | `SELECT sum(total_amount) FROM orders WHERE status = 'completed'`               | Admin            |
| **Pending Refunds**  | `SELECT count(*) FROM refunds WHERE status = 'pending'`                         | Admin, Moderator |
| **Flagged Feedback** | `SELECT count(*) FROM feedback WHERE status = 'flagged'`                        | Admin, Moderator |
| **Flagged Products** | `SELECT count(*) FROM products WHERE status = 'inactive'`                       | Admin, Moderator |
| **Active Sellers**   | `SELECT count(*) FROM users_profile WHERE role = 'seller' AND is_active = true` | Admin            |

**Moderator Dashboard Stats (Scoped to Their Domain):**

| Stat                 | Query                                                                                                                  | Purpose                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Pending Feedback** | `SELECT count(*) FROM feedback WHERE status = 'flagged'`                                                               | Content moderation queue  |
| **Pending Refunds**  | `SELECT count(*) FROM refunds WHERE status = 'manual_review'`                                                          | Manual review queue       |
| **Flagged Products** | `SELECT count(*) FROM products WHERE status = 'inactive'`                                                              | Products awaiting review  |
| **Recent Warnings**  | `SELECT count(*) FROM activity_logs WHERE activity_type = 'security_event' AND created_at > now() - interval '7 days'` | Security events this week |

**Location:** `app/(admin)/admin/page.tsx` fetches stats conditionally based on role and renders StatCard components.

---

## Category Management (Admin Only)

### Business Rules

The service layer enforces three critical business rules:

#### Rule 1: Auto-Computed Level

**Logic:**

```
if (parent_category_id === null)
  → level = 0  (root category)

if (parent_category_id !== null)
  → level = parent.level + 1  (child inherits parent's level + 1)
```

**Rationale:** Levels enable efficient hierarchical queries without recursion. The UI can group categories by level for display.

**Enforcement Location:** `lib/services/category.service.ts` in `createCategory()` and `updateCategory()` functions. Clients cannot override the level; it is computed server-side.

#### Rule 2: Unique Name Under Parent

**Logic:**

```
if (parent_category_id === null)
  → name must be unique globally among all root categories

if (parent_category_id !== null)
  → name must be unique among siblings with same parent_category_id
```

**Rationale:** The DB has a `UNIQUE (name, parent_category_id)` constraint. The service validates before querying to return a user-friendly error instead of a raw Postgres constraint violation.

**Error Message:**

```
"A category with this name already exists under the selected parent."
```

**Enforcement Location:** `lib/services/category.service.ts` calls `repository.nameExistsUnderParent(name, parentId)` before insert/update.

#### Rule 3: Soft-Delete Guard (No Active Products)

**Logic:**

```
Before setting is_active = false:
  → Query: SELECT EXISTS (
              SELECT 1 FROM products
              WHERE category_id = ?
                AND status NOT IN ('archived')
            )

  if (exists)
    → Throw error, abort soft-delete

  else
    → Proceed with is_active = false
```

**Rationale:** Categories with active products cannot be deactivated because sellers would be unable to fulfill those orders. The product status field tracks: 'active', 'archived', 'flagged_for_review'. Only 'archived' products are "safe" to deactivate with.

**Error Message:**

```
"Cannot deactivate a category with active products.
 Archive or reassign the products first."
```

**Enforcement Location:** `lib/services/category.service.ts` in `softDeleteCategory()` function.

### Server Actions Security Pattern

All category mutation actions follow a consistent 4-step security pattern.

**File:** `lib/actions/category.actions.ts`

```typescript
'use server';

/**
 * Create a new product category.
 * Admin-only action.
 */
export async function createCategoryAction(rawInput: unknown) {
  // STEP 1: Authenticate
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { success: false, error: 'Unauthorized: Not authenticated' };
  }

  // STEP 2: Authorize (fetch role from DB, not JWT)
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role, is_active')
    .eq('user_id', session.user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'Unauthorized: Profile not found' };
  }

  if (profile.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin role required' };
  }

  if (!profile.is_active) {
    return { success: false, error: 'Unauthorized: Account suspended' };
  }

  // STEP 3: Validate Input
  const parsed = CreateCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return { success: false, error: `Validation failed: ${firstError.message}` };
  }

  // STEP 4: Execute
  try {
    const result = await categoryController.createCategory(parsed.data);

    // Revalidate affected paths
    revalidatePath('/admin/categories');
    revalidatePath('/seller/products/new');
    revalidatePath('/seller/products/[productId]/edit', 'page');

    return { success: true, data: result };
  } catch (err) {
    // Never expose raw error to client; sanitize message
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}
```

**Key Principles:**

1. **Authenticate First:** Extract session from SSR middleware.
2. **Authorize Second:** ALWAYS fetch role from `users_profile` table, NOT from JWT claims. JWT claims can be stale; the DB is the source of truth.
3. **Validate Third:** Use Zod to parse and validate user input. Return first validation error to user.
4. **Execute Last:** Call the controller. If it throws, catch and return a safe error message to the client.
5. **Revalidate on Success:** Call `revalidatePath()` for all pages that rendered the stale data.
6. **Return Discriminated Union:** Always return `{ success: boolean; data?: T; error?: string }` for predictable error handling in the client.

### Zod Validation Schemas

**File:** `lib/actions/category.actions.ts` or `lib/validators/category.schema.ts`

```typescript
import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less'),

  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .nullish()
    .transform((v) => v || null),

  parent_category_id: z
    .number()
    .int()
    .positive('Parent category ID must be a positive integer')
    .nullish()
    .transform((v) => v || null),

  level: z
    .number()
    .int()
    .nonnegative('Level must be non-negative')
    .optional()
    .describe('Auto-computed by service; provided value is ignored'),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  is_active: z
    .boolean()
    .optional()
    .describe('Soft-delete flag; deactivates for sellers but keeps in DB'),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
```

**Validation Notes:**

- `name` and `description` are trimmed of whitespace before validation
- `parent_category_id` is a `number` (BigInt), not a string. Client must cast from select dropdown.
- `level` is optional in create input because the service auto-computes it. If provided by client, it is silently ignored.
- `is_active` is only used in update (soft-delete); cannot be set on create (defaults to true in DB).

### UI Components

**Category Table:**

- File: `components/admin/categories/category-table.tsx`
- Displays all categories (active and inactive) in a data table
- Columns: name, parent, level, status (active/inactive), actions (edit, delete)
- Features: search by name, filter by level or parent
- onClick edit → category-form-dialog opens in "Edit" mode
- onClick delete → category-delete-dialog opens (soft-delete alert)

**Category Form Dialog:**

- File: `components/admin/categories/category-form-dialog.tsx`
- Reusable modal for both create and edit
- Fields: name (required), description (optional), parent category (dropdown), level (read-only)
- Parent dropdown shows only root and 1st-level categories (prevents deep nesting)
- Submit → calls createCategoryAction or updateCategoryAction
- Displays Zod validation errors inline
- On success, closes dialog and table refetches

**Category Delete Dialog:**

- File: `components/admin/categories/category-delete-dialog.tsx`
- AlertDialog confirmation (not a destructive delete)
- Reiterates: "Deactivating will hide this category from sellers. Active products will not be affected."
- Submit → calls softDeleteCategoryAction
- On success, table refetches and dialog closes

---

## Seller Integration

### Product Form Category Dropdown

**Location:** `app/(seller)/seller/products/new/page.tsx` and `app/(seller)/seller/products/[productId]/edit/page.tsx`

**Before (PROD-02):**

- Category was a hardcoded static list or stored as a string label
- No link to category_id in categories table
- Category options could not be managed by admin

**After (PROD-04):**

- Page fetches active categories via `getActiveCategories()` controller
- Categories passed as Server Component props to ProductForm client component
- Shadcn `<Select>` renders options grouped by level (visual hierarchy)
- Selected category_id is stored as a `number` on the product record
- Foreign key `products.category_id` references `categories.category_id`

**Data Flow:**

```typescript
// app/(seller)/seller/products/new/page.tsx (RSC)
export default async function NewProductPage() {
  const categories = await categoryController.getActiveCategories();
  // categories: Category[] where is_active = true

  return <ProductForm mode="create" categories={categories} />;
}

// components/forms/product-form.tsx (Client Component)
interface ProductFormProps {
  categories: Category[];
  // ...other props
}

export function ProductForm({ categories, ...props }: ProductFormProps) {
  return (
    <form>
      {/* ...other fields */}

      <Select name="category_id">
        <SelectTrigger>Select Category</SelectTrigger>
        <SelectContent>
          {/* Group by level for hierarchy display */}
          {groupedCategories.map(group => (
            <SelectGroup key={group.level} label={`${group.name}`}>
              {group.items.map(cat => (
                <SelectItem
                  key={cat.category_id}
                  value={String(cat.category_id)}  // ← Cast to string for HTML
                >
                  {cat.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* ...submit button */}
    </form>
  );
}
```

**Type Safety:**

```typescript
// In form submission handler
const formData = new FormData(event.currentTarget);
const categoryIdString = formData.get('category_id') as string;
const categoryId = parseInt(categoryIdString, 10); // ← Parse from string back to number

// Now categoryId: number is ready for the product creation action
await createProductAction({ categoryId, ...otherFields });
```

**Why Grouped Display:**
Displaying categories grouped by level provides visual hierarchy to sellers:

```
┌─ Electronics (level 0)
│  ├─ Phones (level 1)
│  ├─ Laptops (level 1)
│  └─ Accessories (level 1)
│     ├─ Phone Chargers (level 2)
│     └─ Cables (level 2)
└─ Fashion (level 0)
   └─ Clothing (level 1)
```

---

## Routes Reference

| Route               | Access           | Description                               | Page Component                          |
| ------------------- | ---------------- | ----------------------------------------- | --------------------------------------- |
| `/admin`            | admin, moderator | Dashboard home with role-scoped stats     | `app/(admin)/admin/page.tsx`            |
| `/admin/categories` | admin only       | Category CRUD and management interface    | `app/(admin)/admin/categories/page.tsx` |
| `/admin/feedback`   | admin, moderator | Flagged feedback moderation queue         | (separate feature)                      |
| `/admin/refunds`    | admin, moderator | Refund request review and processing      | (separate feature)                      |
| `/admin/products`   | admin, moderator | Product moderation and status updates     | (separate feature)                      |
| `/admin/users`      | admin, moderator | User warning and suspension management    | (separate feature)                      |
| `/admin/ai-configs` | admin only       | AI model configuration viewer (read-only) | (separate feature)                      |
| `/admin/logs`       | admin only       | Activity audit log viewer                 | (separate feature)                      |

**Protected Route:**  
All `/admin/*` routes are protected by `app/(admin)/layout.tsx`. Unauthenticated users are redirected to `/auth/login`. Non-admin/moderator users are redirected to `/`.

---

## Revalidation Map

When categories are created, updated, or soft-deleted, the following paths must be revalidated to reflect changes:

| Action               | Path                                | Reason                                                   |
| -------------------- | ----------------------------------- | -------------------------------------------------------- |
| Create category      | `/admin/categories`                 | Category table displays new entry                        |
| Create category      | `/seller/products/new`              | Category dropdown now includes new option                |
| Create category      | `/seller/products/[productId]/edit` | Category dropdown now includes new option                |
| Update category      | `/admin/categories`                 | Table displays updated name/description/parent           |
| Update category      | `/seller/products/new`              | Category name/grouping may have changed                  |
| Update category      | `/seller/products/[productId]/edit` | Category name/grouping may have changed                  |
| Soft-delete category | `/admin/categories`                 | Category marked inactive in table                        |
| Soft-delete category | `/seller/products/new`              | Category removed from dropdown (if querying active only) |
| Soft-delete category | `/seller/products/[productId]/edit` | Category removed from dropdown                           |

**Implementation in Server Actions:**

```typescript
// After mutation succeeds
revalidatePath('/admin/categories');
revalidatePath('/seller/products/new');
revalidatePath('/seller/products/[productId]/edit', 'page');
```

The `'page'` argument ensures the layout is not revalidated (avoiding unnecessary re-renders of shared header/nav).

---

## Key Constraints & Gotchas

### 1. `category_id` is a `number`, not `string`

**Why:** Category IDs use PostgreSQL `bigserial` type, which maps to JavaScript `number`. Unlike users, orders, and other entities that use `uuid` strings, categories use numeric IDs.

**Gotcha:** When storing on a product or in the form dropdown, forgetting to parse `category_id` from string back to number will cause `products.category_id` to store the wrong type or fail the foreign key constraint.

**Fix:**

```typescript
const categoryId = parseInt(formData.get('category_id') as string, 10);
```

### 2. Soft-Delete Only — Never Hard-Delete

**Rule:** Categories are never deleted from the database. They are soft-deleted by setting `is_active = false`. This prevents:

- Breaking foreign key references from products
- Data loss and audit trail gaps
- Orphaning historical orders referencing the category

**Consequence:** The database will accumulate inactive categories over time. Queries must filter `WHERE is_active = true` when fetching for dropdowns (which happens via `getActiveCategories()`). Admin views show all categories including inactive ones for audit purposes.

### 3. Use `redirect()` for Admin Routes, `notFound()` for Admin-Only Pages

**Pattern:**

- **`layout.tsx`** (covers entire route group): Use `redirect()` for auth/role failures

  ```typescript
  if (!session) redirect('/auth/login');
  if (profile.role !== 'admin' && profile.role !== 'moderator') redirect('/');
  ```

- **`page.tsx` inside admin-only page** (e.g., categories): Use `notFound()` for role check
  ```typescript
  if (adminUser.role !== 'admin') notFound();
  ```

**Rationale:** `redirect()` tells the user "go to this other URL"; `notFound()` tells the browser "this URL doesn't exist." Using `notFound()` for unauthorized page access doesn't leak route structure to unauthorized users.

### 4. Always Fetch Role from `users_profile` at Authorization Time

**Anti-Pattern:**

```typescript
// ❌ DON'T: Trust JWT claims
const role = session.user.user_metadata?.role;
if (role !== 'admin') return error; // ← Stale claim!
```

**Correct Pattern:**

```typescript
// ✅ DO: Fetch from DB
const { data: profile } = await supabase
  .from('users_profile')
  .select('role, is_active')
  .eq('user_id', session.user.id)
  .single();

if (profile.role !== 'admin') return error;
```

**Rationale:** JWT claims are set at sign-in time and don't update until logout/re-login. If an admin is demoted to seller mid-session, a check against stale JWT would grant admin access until logout. Always read the DB for authorization.

### 5. Navbar Visibility ≠ Security

**Caveat:** The "Admin Dashboard" link in the navbar is hidden from non-admin/moderator users. This is a **UX convenience only**.

**Why:** Determined users can directly navigate to `/admin` and will be blocked by the layout guard. Hiding the link doesn't protect anything; it just keeps the UI clean. Do not rely on hidden navigation as security.

### 6. Unique Constraint on `(name, parent_category_id)`

**Constraint:**

```sql
UNIQUE (name, parent_category_id)
```

**Implication:**

- Root categories (parent_category_id = NULL) must have globally unique names
- Child categories under the same parent must have unique names
- BUT: Different parents can have children with the same name
  - Electronics → Phones
  - Furniture → Phones (allowed)

**Service-Layer Validation:** Before insert/update, the service calls `repository.nameExistsUnderParent(name, parentId)` to catch this before hitting the Postgres constraint, returning a user-friendly error.

### 7. Soft-Delete Guard: Check for Active Products First

**Rule:** Cannot deactivate a category if it has active (non-archived) products.

**Consequence:** A seller with a product in the "Laptops" category will keep that category "locked" as active until they archive the product or reassign it. Sellers should be warned during product creation if they're using a deprecated category, or product form should only show active categories.

**Note:** Current implementation restricts the seller form to `getActiveCategories()` (active only), so sellers cannot assign new products to inactive categories. Existing products in inactive categories remain linked but sellers can no longer create new products in that category.

### 8. Moderators Cannot Moderate Other Moderators or Admins

**When moderators use the user suspension feature** (`user-moderation.service.ts`), they can only suspend/warn users with role `buyer` or `seller`. They cannot act on other moderators or admins.

**Enforcement:** Not just UI-level; the service layer has a guard:

```typescript
if (targetProfile.role === 'admin' || targetProfile.role === 'moderator') {
  throw new Error('Cannot moderate other admins or moderators');
}
```

### 9. Product Status ≠ Category Status

**Clarification:** A product has a `status` field (active, archived, flagged_for_review). A category has an `is_active` boolean. These are separate concerns.

| Entity   | Field       | Values                               | Who Controls                               |
| -------- | ----------- | ------------------------------------ | ------------------------------------------ |
| Product  | `status`    | active, archived, flagged_for_review | Seller (can archive), Moderator (can flag) |
| Category | `is_active` | true, false                          | Admin only                                 |

**When a category is deactivated:** Existing products in that category are NOT automatically soft-deleted. Sellers can still fulfill orders for those products, but they cannot create NEW products in that category.

---

## Future Considerations

### Not Yet Implemented

1. **Category Icons/Colors:** Categories could have optional `icon_url` and `color_hex` fields for UI customization. Current implementation uses only name.

2. **Category Descriptions Template:** Categories could have a JSON template for structured product descriptions (e.g., Electronics categories auto-populate specs like "Processor", "RAM").

3. **Category Bulk Operations:** Admin can currently only create/edit/delete one category at a time. Bulk import/export would be valuable.

4. **AI Configs Write Actions:** The `/admin/ai-configs` page is currently read-only. Full CRUD for AI model configuration is a future task.

5. **Activity Logs Search & Export:** The `/admin/logs` page displays logs but doesn't support filtering by user, date range, or exporting. These would enhance debugging and compliance.

6. **Category Move (Reparent):** Once a category is created, its parent cannot be changed. A move operation would require handling the cascading level updates and DB constraints.

7. **Soft-Delete Retention Policy:** Categories marked inactive are kept forever. A future archival policy could hard-delete inactive categories after N days.

---

## Summary

PROD-04 establishes the foundational category management system for BuySmart. It demonstrates:

- **Layered architecture:** Server action → controller → service → repository → Supabase
- **Security patterns:** Multi-step authorization (auth + role + is_active), Zod validation, role-gated actions
- **Business rule enforcement:** Auto-computed level, uniqueness validation, soft-delete guards
- **Shared admin dashboard:** Unified `/admin` route group with role-based access control via PERMISSIONS map
- **Data integrity:** Foreign keys, RLS, constraints, and service-layer validation working in concert

The implementation prioritizes **security-by-default** (checks at multiple layers), **type safety** (TypeScript + Zod), and **predictable error handling** (discriminated union return types).

---

**Document Maintainers:** Development Team  
**Last Reviewed:** March 2026  
**Next Review:** (Upon feature expansion or major refactor)
