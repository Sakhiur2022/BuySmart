-- BuySmart Supabase schema (DB-02)
-- PostgreSQL SQL only

-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type user_role_enum as enum ('buyer', 'seller', 'admin', 'moderator');
create type product_status_enum as enum ('draft', 'active', 'inactive', 'out_of_stock', 'archived');
create type order_status_enum as enum ('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled');
create type order_item_status_enum as enum ('pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled');
create type payment_status_enum as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type feedback_type_enum as enum ('product_review', 'seller_review', 'service_feedback', 'general_feedback');
create type feedback_status_enum as enum ('draft', 'published', 'hidden', 'flagged', 'archived');
create type ai_sentiment_enum as enum ('positive', 'neutral', 'negative', 'mixed');
create type ai_feedback_category_enum as enum ('product_quality', 'delivery', 'customer_service', 'pricing', 'user_experience', 'other');
create type ai_urgency_enum as enum ('low', 'medium', 'high', 'critical');
create type refund_type_enum as enum ('full_order', 'partial_order', 'single_item');
create type refund_reason_enum as enum ('damaged', 'defective', 'wrong_item', 'not_as_described', 'size_issue', 'changed_mind', 'duplicate_order', 'late_delivery', 'other');
create type refund_status_enum as enum ('pending', 'ai_review', 'manual_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled');
create type ai_refund_decision_enum as enum ('auto_approve', 'manual_review', 'auto_reject');
create type activity_type_enum as enum ('auth', 'product_view', 'search', 'cart', 'order', 'payment', 'feedback', 'refund', 'ai_action', 'system_event', 'security_event');
create type log_severity_enum as enum ('debug', 'info', 'warning', 'error', 'critical');
create type log_status_enum as enum ('success', 'failure', 'partial', 'timeout');

-- Core tables
create table if not exists users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(255),
  display_name varchar(100),
  avatar_url text,
  phone varchar(20),
  address jsonb,
  role user_role_enum not null default 'buyer',
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  email_verified boolean not null default false,
  profile_completed boolean not null default false
);

create table if not exists categories (
  category_id bigserial primary key,
  name varchar(100) not null,
  description text,
  parent_category_id bigint references categories(category_id) on delete set null,
  level int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, parent_category_id)
);

create table if not exists products (
  product_id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references users_profile(user_id) on delete cascade,
  category_id bigint references categories(category_id) on delete set null,
  name varchar(255) not null,
  description text,
  short_description varchar(500),
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  cost_price numeric(10,2),
  sku varchar(100) unique,
  barcode varchar(100),
  inventory_quantity int not null default 0,
  inventory_tracked boolean not null default true,
  weight numeric(8,2),
  dimensions jsonb,
  images jsonb,
  tags text[],
  meta_data jsonb,
  status product_status_enum not null default 'draft',
  featured boolean not null default false,
  seo_title varchar(255),
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  order_id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users_profile(user_id) on delete cascade,
  order_number varchar(50) not null unique,
  status order_status_enum not null default 'draft',
  subtotal numeric(10,2) not null,
  tax_amount numeric(10,2) not null default 0,
  shipping_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  currency varchar(3) not null default 'USD',
  payment_status payment_status_enum not null default 'pending',
  payment_method varchar(50),
  payment_reference varchar(255),
  shipping_address jsonb,
  billing_address jsonb,
  notes text,
  tracking_number varchar(255),
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(order_id) on delete cascade,
  product_id uuid not null references products(product_id) on delete restrict,
  seller_id uuid not null references users_profile(user_id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  product_snapshot jsonb,
  status order_item_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table if not exists feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users_profile(user_id) on delete cascade,
  product_id uuid references products(product_id) on delete set null,
  order_id uuid references orders(order_id) on delete set null,
  order_item_id uuid references order_items(order_item_id) on delete set null,
  feedback_type feedback_type_enum not null,
  rating int check (rating >= 1 and rating <= 5),
  title varchar(255),
  comment text,
  images jsonb,
  is_verified_purchase boolean not null default false,
  ai_sentiment ai_sentiment_enum,
  ai_category ai_feedback_category_enum,
  ai_urgency ai_urgency_enum,
  ai_keywords text[],
  ai_processed_at timestamptz,
  ai_confidence_score numeric(3,2) check (ai_confidence_score >= 0 and ai_confidence_score <= 1),
  status feedback_status_enum not null default 'draft',
  is_helpful int not null default 0,
  is_reported boolean not null default false,
  moderated_at timestamptz,
  moderator_id uuid references users_profile(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, order_item_id)
);

create table if not exists refunds (
  refund_id uuid primary key default gen_random_uuid(),
  refund_number varchar(50) not null unique,
  order_id uuid not null references orders(order_id) on delete cascade,
  order_item_id uuid references order_items(order_item_id) on delete set null,
  user_id uuid not null references users_profile(user_id) on delete cascade,
  refund_type refund_type_enum not null,
  reason_code refund_reason_enum not null,
  reason_description text,
  refund_amount numeric(10,2) not null,
  requested_amount numeric(10,2) not null,
  status refund_status_enum not null default 'pending',
  ai_recommendation ai_refund_decision_enum,
  ai_risk_score numeric(3,2) check (ai_risk_score >= 0 and ai_risk_score <= 1),
  ai_analysis jsonb,
  ai_processed_at timestamptz,
  evidence_images jsonb,
  return_required boolean not null default false,
  return_tracking varchar(255),
  return_received_at timestamptz,
  processed_by uuid references users_profile(user_id) on delete set null,
  processed_at timestamptz,
  processing_notes text,
  payment_reference varchar(255),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(user_id) on delete set null,
  session_id uuid,
  activity_type activity_type_enum not null,
  entity_type varchar(50),
  entity_id uuid,
  action varchar(100),
  agent_name varchar(100),
  agent_version varchar(20),
  model_used varchar(100),
  input_data jsonb,
  output_data jsonb,
  confidence_score numeric(3,2),
  processing_time_ms int,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  severity log_severity_enum not null default 'info',
  status log_status_enum not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists ai_model_configs (
  config_id bigserial primary key,
  agent_name varchar(100) not null,
  model_name varchar(100) not null,
  version varchar(20) not null,
  configuration jsonb not null,
  is_active boolean not null default true,
  performance_metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_name, is_active) deferrable initially immediate
);

-- Indexes
create index if not exists idx_products_seller_status on products (seller_id, status);
create index if not exists idx_products_category_status on products (category_id, status);
create index if not exists idx_orders_buyer_status on orders (buyer_id, status);
create index if not exists idx_orders_status_created on orders (status, created_at);
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_order_items_product on order_items (product_id);
create index if not exists idx_order_items_seller on order_items (seller_id);
create index if not exists idx_feedback_product_status_rating on feedback (product_id, status, rating);
create index if not exists idx_feedback_user_type on feedback (user_id, feedback_type);
create index if not exists idx_feedback_ai on feedback (ai_sentiment, ai_category);
create index if not exists idx_refunds_user_status on refunds (user_id, status);
create index if not exists idx_refunds_order_status on refunds (order_id, status);
create index if not exists idx_refunds_status_created on refunds (status, created_at);
create index if not exists idx_refunds_ai_reco on refunds (ai_recommendation, status);
create index if not exists idx_logs_user_created on activity_logs (user_id, created_at desc);
create index if not exists idx_logs_activity_created on activity_logs (activity_type, created_at desc);
create index if not exists idx_logs_agent_created on activity_logs (agent_name, created_at desc);
create index if not exists idx_logs_entity on activity_logs (entity_type, entity_id);
create index if not exists idx_logs_created on activity_logs (created_at desc);

-- RLS
alter table users_profile enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table feedback enable row level security;
alter table refunds enable row level security;
alter table activity_logs enable row level security;
alter table ai_model_configs enable row level security;

-- Helper check for admin role
create or replace function is_admin(user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from users_profile up
    where up.user_id = $1
      and up.role = 'admin'
      and up.is_active = true
  );
$$;

-- Users profile
create policy "users_profile_self_read" on users_profile
  for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "users_profile_self_write" on users_profile
  for update
  using (user_id = auth.uid() or is_admin(auth.uid()))
  with check (user_id = auth.uid() or is_admin(auth.uid()));

-- Categories (public read)
create policy "categories_public_read" on categories
  for select
  using (true);

-- Products (public read; sellers manage own)
create policy "products_public_read" on products
  for select
  using (status = 'active' or is_admin(auth.uid()) or seller_id = auth.uid());

create policy "products_owner_write" on products
  for all
  using (seller_id = auth.uid() or is_admin(auth.uid()))
  with check (seller_id = auth.uid() or is_admin(auth.uid()));

-- Orders (buyers can view own orders; admin can access all)
create policy "orders_buyer_read" on orders
  for select
  using (buyer_id = auth.uid() or is_admin(auth.uid()));

create policy "orders_buyer_write" on orders
  for insert
  with check (buyer_id = auth.uid() or is_admin(auth.uid()));

-- Order items (buyers can read their order items; admin can access all)
create policy "order_items_buyer_read" on order_items
  for select
  using (
    is_admin(auth.uid())
    or exists (
      select 1 from orders o
      where o.order_id = order_items.order_id
        and o.buyer_id = auth.uid()
    )
  );

-- Feedback (users can insert only for purchased products; admin access)
create policy "feedback_insert_purchased" on feedback
  for insert
  with check (
    (user_id = auth.uid() or is_admin(auth.uid()))
    and exists (
      select 1
      from order_items oi
      join orders o on o.order_id = oi.order_id
      where o.buyer_id = auth.uid()
        and oi.product_id = feedback.product_id
    )
  );

create policy "feedback_read_public_or_owner" on feedback
  for select
  using (status = 'published' or user_id = auth.uid() or is_admin(auth.uid()));

-- Refunds (users can request refunds only for their own orders; admin access)
create policy "refunds_insert_own_order" on refunds
  for insert
  with check (
    (user_id = auth.uid() or is_admin(auth.uid()))
    and exists (
      select 1 from orders o
      where o.order_id = refunds.order_id
        and o.buyer_id = auth.uid()
    )
  );

create policy "refunds_read_owner" on refunds
  for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- Logs (admin only)
create policy "activity_logs_admin_only" on activity_logs
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- AI model configs (admin only)
create policy "ai_model_configs_admin_only" on ai_model_configs
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
