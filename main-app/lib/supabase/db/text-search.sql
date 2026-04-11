-- Full-text search support for buyer product search
-- Covers: product name + short description + description + category name
-- Compatible with repository .textSearch('search_vector', query, { config: 'english', type: 'websearch' })

create extension if not exists unaccent;

-- 1) Add tsvector column
alter table public.products
  add column if not exists search_vector tsvector;

-- 2) Function to build product search vector (includes category name)
create or replace function public.compute_product_search_vector(
  p_name text,
  p_short_description text,
  p_description text,
  p_category_name text
) returns tsvector
language sql
immutable
as $$
  select
    setweight(to_tsvector('english', unaccent(coalesce(p_name, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(p_category_name, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(p_short_description, ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(p_description, ''))), 'C');
$$;

-- 3) Trigger function for products table writes
create or replace function public.products_set_search_vector()
returns trigger
language plpgsql
as $$
declare
  v_category_name text;
begin
  if new.category_id is not null then
    select c.name
      into v_category_name
    from public.categories c
    where c.category_id = new.category_id;
  end if;

  new.search_vector := public.compute_product_search_vector(
    new.name,
    new.short_description,
    new.description,
    v_category_name
  );

  return new;
end;
$$;

drop trigger if exists trg_products_set_search_vector on public.products;

create trigger trg_products_set_search_vector
before insert or update of name, short_description, description, category_id
on public.products
for each row
execute function public.products_set_search_vector();

-- 4) Keep vectors in sync when category name changes
create or replace function public.categories_refresh_products_search_vector()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name then
    update public.products p
       set search_vector = public.compute_product_search_vector(
         p.name,
         p.short_description,
         p.description,
         new.name
       )
     where p.category_id = new.category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_categories_refresh_products_search_vector on public.categories;

create trigger trg_categories_refresh_products_search_vector
after update of name
on public.categories
for each row
execute function public.categories_refresh_products_search_vector();

-- 5) Backfill existing rows
update public.products p
   set search_vector = public.compute_product_search_vector(
     p.name,
     p.short_description,
     p.description,
     c.name
   )
  from public.categories c
 where p.category_id = c.category_id;

-- Also backfill products with no category
update public.products p
   set search_vector = public.compute_product_search_vector(
     p.name,
     p.short_description,
     p.description,
     null
   )
 where p.category_id is null;

-- 6) Add GIN index for fast FTS
create index if not exists idx_products_search_vector
  on public.products
  using gin (search_vector);