create or replace function public.is_email_confirmed()
returns boolean
language sql
stable
as $$
  select (auth.jwt() ->> 'email_confirmed_at') is not null;
$$;

drop policy if exists "users_profile_self_read" on users_profile;
drop policy if exists "users_profile_self_write" on users_profile;
drop policy if exists "products_public_read" on products;
drop policy if exists "products_owner_write" on products;
drop policy if exists "orders_buyer_read" on orders;
drop policy if exists "orders_buyer_write" on orders;
drop policy if exists "order_items_buyer_read" on order_items;
drop policy if exists "feedback_insert_purchased" on feedback;
drop policy if exists "feedback_read_public_or_owner" on feedback;
drop policy if exists "refunds_insert_own_order" on refunds;
drop policy if exists "refunds_read_owner" on refunds;
drop policy if exists "activity_logs_admin_only" on activity_logs;
drop policy if exists "ai_model_configs_admin_only" on ai_model_configs;

create policy "users_profile_self_read" on users_profile
  for select
  using (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "users_profile_self_write" on users_profile
  for update
  using (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
  )
  with check (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "products_public_read" on products
  for select
  using (
    status = 'active'
    or (
      is_email_confirmed()
      and (is_admin(auth.uid()) or seller_id = auth.uid())
    )
  );

create policy "products_owner_write" on products
  for all
  using (
    is_email_confirmed()
    and (seller_id = auth.uid() or is_admin(auth.uid()))
  )
  with check (
    is_email_confirmed()
    and (seller_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "orders_buyer_read" on orders
  for select
  using (
    is_email_confirmed()
    and (buyer_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "orders_buyer_write" on orders
  for insert
  with check (
    is_email_confirmed()
    and (buyer_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "order_items_buyer_read" on order_items
  for select
  using (
    is_email_confirmed()
    and (
      is_admin(auth.uid())
      or exists (
        select 1 from orders o
        where o.order_id = order_items.order_id
          and o.buyer_id = auth.uid()
      )
    )
  );

create policy "feedback_insert_purchased" on feedback
  for insert
  with check (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
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
  using (
    status = 'published'
    or (
      is_email_confirmed()
      and (user_id = auth.uid() or is_admin(auth.uid()))
    )
  );

create policy "refunds_insert_own_order" on refunds
  for insert
  with check (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
    and exists (
      select 1 from orders o
      where o.order_id = refunds.order_id
        and o.buyer_id = auth.uid()
    )
  );

create policy "refunds_read_owner" on refunds
  for select
  using (
    is_email_confirmed()
    and (user_id = auth.uid() or is_admin(auth.uid()))
  );

create policy "activity_logs_admin_only" on activity_logs
  for all
  using (is_email_confirmed() and is_admin(auth.uid()))
  with check (is_email_confirmed() and is_admin(auth.uid()));

create policy "ai_model_configs_admin_only" on ai_model_configs
  for all
  using (is_email_confirmed() and is_admin(auth.uid()))
  with check (is_email_confirmed() and is_admin(auth.uid()));
