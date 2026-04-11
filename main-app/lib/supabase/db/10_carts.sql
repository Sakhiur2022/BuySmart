-- Cart persistence schema

create table if not exists carts (
  cart_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users_profile(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists cart_items (
  cart_item_id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(cart_id) on delete cascade,
  product_id uuid not null references products(product_id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index if not exists idx_carts_user on carts (user_id);
create index if not exists idx_cart_items_cart on cart_items (cart_id);
create index if not exists idx_cart_items_product on cart_items (product_id);

alter table carts enable row level security;
alter table cart_items enable row level security;

drop policy if exists "carts_user_read" on carts;
drop policy if exists "carts_user_insert" on carts;
drop policy if exists "carts_user_update" on carts;
drop policy if exists "carts_user_delete" on carts;

create policy "carts_user_read" on carts
  for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "carts_user_insert" on carts
  for insert
  with check (user_id = auth.uid() or is_admin(auth.uid()));

create policy "carts_user_update" on carts
  for update
  using (user_id = auth.uid() or is_admin(auth.uid()))
  with check (user_id = auth.uid() or is_admin(auth.uid()));

create policy "carts_user_delete" on carts
  for delete
  using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "cart_items_user_read" on cart_items;
drop policy if exists "cart_items_user_insert" on cart_items;
drop policy if exists "cart_items_user_update" on cart_items;
drop policy if exists "cart_items_user_delete" on cart_items;

create policy "cart_items_user_read" on cart_items
  for select
  using (
    is_admin(auth.uid())
    or exists (
      select 1
      from carts c
      where c.cart_id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

create policy "cart_items_user_insert" on cart_items
  for insert
  with check (
    is_admin(auth.uid())
    or exists (
      select 1
      from carts c
      where c.cart_id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

create policy "cart_items_user_update" on cart_items
  for update
  using (
    is_admin(auth.uid())
    or exists (
      select 1
      from carts c
      where c.cart_id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    is_admin(auth.uid())
    or exists (
      select 1
      from carts c
      where c.cart_id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

create policy "cart_items_user_delete" on cart_items
  for delete
  using (
    is_admin(auth.uid())
    or exists (
      select 1
      from carts c
      where c.cart_id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_carts_set_updated_at on carts;
create trigger trg_carts_set_updated_at
before update on carts
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists trg_cart_items_set_updated_at on cart_items;
create trigger trg_cart_items_set_updated_at
before update on cart_items
for each row
execute function public.set_updated_at_timestamp();