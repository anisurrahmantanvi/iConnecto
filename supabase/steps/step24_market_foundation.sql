-- iConnecto Buy & Sell, Phase 1 (foundation): categories, listings, listing media/attributes, storage.
-- Own module: every table starts with dealsafe_. Does not touch existing tables. Idempotent.
-- No money, escrow or payment tables yet (Phase 6, only after a licensed provider agreement).

create table if not exists public.dealsafe_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.dealsafe_categories(id) on delete cascade,
  slug text not null unique,
  name text not null,
  name_bn text,
  kind text not null default 'physical' check (kind in ('physical','digital','service')),
  sort integer not null default 0,
  active boolean not null default true
);
alter table public.dealsafe_categories enable row level security;
revoke all on public.dealsafe_categories from anon, authenticated;
grant select on public.dealsafe_categories to authenticated;
drop policy if exists dealsafe_categories_select on public.dealsafe_categories;
create policy dealsafe_categories_select on public.dealsafe_categories for select to authenticated using (active);

insert into public.dealsafe_categories (slug, name, name_bn, kind, sort) values
  ('mobiles', 'Mobiles & Tablets', 'মোবাইল ও ট্যাবলেট', 'physical', 1),
  ('electronics', 'Electronics', 'ইলেকট্রনিক্স', 'physical', 2),
  ('computers', 'Computers & Laptops', 'কম্পিউটার ও ল্যাপটপ', 'physical', 3),
  ('vehicles', 'Vehicles', 'যানবাহন', 'physical', 4),
  ('fashion', 'Fashion & Clothing', 'ফ্যাশন ও পোশাক', 'physical', 5),
  ('home', 'Home & Living', 'ঘর ও আসবাব', 'physical', 6),
  ('books', 'Books & Hobbies', 'বই ও শখ', 'physical', 7),
  ('sports', 'Sports & Fitness', 'খেলাধুলা ও ফিটনেস', 'physical', 8),
  ('baby-kids', 'Baby & Kids', 'শিশু ও বাচ্চা', 'physical', 9),
  ('other', 'Other', 'অন্যান্য', 'physical', 99)
on conflict (slug) do nothing;

create table if not exists public.dealsafe_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category_id uuid references public.dealsafe_categories(id) on delete set null,
  kind text not null default 'physical' check (kind in ('physical','digital','service')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  condition text check (condition in ('new','like_new','used','for_parts')),
  price_paisa bigint not null default 0 check (price_paisa >= 0),
  negotiable boolean not null default false,
  stock integer not null default 1 check (stock >= 0),
  location text check (char_length(location) <= 120),
  delivery_methods text[] not null default '{}',
  delivery_charge_paisa bigint not null default 0 check (delivery_charge_paisa >= 0),
  status text not null default 'draft' check (status in ('draft','published','paused','sold','removed')),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dealsafe_listings_seller_idx on public.dealsafe_listings (seller_id);
create index if not exists dealsafe_listings_feed_idx on public.dealsafe_listings (status, created_at desc);
create index if not exists dealsafe_listings_category_idx on public.dealsafe_listings (category_id);

alter table public.dealsafe_listings enable row level security;
revoke all on public.dealsafe_listings from anon, authenticated;
grant select, delete on public.dealsafe_listings to authenticated;
grant insert (category_id, kind, title, description, condition, price_paisa, negotiable, stock, location, delivery_methods, delivery_charge_paisa, status)
  on public.dealsafe_listings to authenticated;
grant update (category_id, kind, title, description, condition, price_paisa, negotiable, stock, location, delivery_methods, delivery_charge_paisa, status)
  on public.dealsafe_listings to authenticated;

drop policy if exists dealsafe_listings_select on public.dealsafe_listings;
create policy dealsafe_listings_select on public.dealsafe_listings for select to authenticated using (
  seller_id = auth.uid()
  or (status = 'published'
      and not exists (select 1 from public.blocks b
                      where (b.blocker_id = auth.uid() and b.blocked_id = seller_id)
                         or (b.blocker_id = seller_id and b.blocked_id = auth.uid())))
);
drop policy if exists dealsafe_listings_insert on public.dealsafe_listings;
create policy dealsafe_listings_insert on public.dealsafe_listings for insert to authenticated with check (seller_id = auth.uid() and status in ('draft','published'));
drop policy if exists dealsafe_listings_update on public.dealsafe_listings;
create policy dealsafe_listings_update on public.dealsafe_listings for update to authenticated
  using (seller_id = auth.uid() and status <> 'removed') with check (seller_id = auth.uid() and status in ('draft','published','paused','sold'));
drop policy if exists dealsafe_listings_delete on public.dealsafe_listings;
create policy dealsafe_listings_delete on public.dealsafe_listings for delete to authenticated using (seller_id = auth.uid());

create or replace function public.dealsafe_touch_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists dealsafe_listings_touch on public.dealsafe_listings;
create trigger dealsafe_listings_touch before update on public.dealsafe_listings for each row execute function public.dealsafe_touch_updated();

create table if not exists public.dealsafe_listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.dealsafe_listings(id) on delete cascade,
  url text not null,
  type text not null default 'image' check (type in ('image','video')),
  position integer not null default 0
);
create index if not exists dealsafe_listing_media_idx on public.dealsafe_listing_media (listing_id, position);
alter table public.dealsafe_listing_media enable row level security;
revoke all on public.dealsafe_listing_media from anon, authenticated;
grant select, insert, delete on public.dealsafe_listing_media to authenticated;
drop policy if exists dealsafe_listing_media_select on public.dealsafe_listing_media;
create policy dealsafe_listing_media_select on public.dealsafe_listing_media for select to authenticated
  using (exists (select 1 from public.dealsafe_listings l where l.id = listing_id));
drop policy if exists dealsafe_listing_media_write on public.dealsafe_listing_media;
create policy dealsafe_listing_media_write on public.dealsafe_listing_media for insert to authenticated
  with check (exists (select 1 from public.dealsafe_listings l where l.id = listing_id and l.seller_id = auth.uid()));
drop policy if exists dealsafe_listing_media_delete on public.dealsafe_listing_media;
create policy dealsafe_listing_media_delete on public.dealsafe_listing_media for delete to authenticated
  using (exists (select 1 from public.dealsafe_listings l where l.id = listing_id and l.seller_id = auth.uid()));

create table if not exists public.dealsafe_listing_attributes (
  listing_id uuid not null references public.dealsafe_listings(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 40),
  value text not null check (char_length(value) <= 200),
  primary key (listing_id, key)
);
alter table public.dealsafe_listing_attributes enable row level security;
revoke all on public.dealsafe_listing_attributes from anon, authenticated;
grant select, insert, update, delete on public.dealsafe_listing_attributes to authenticated;
drop policy if exists dealsafe_listing_attributes_select on public.dealsafe_listing_attributes;
create policy dealsafe_listing_attributes_select on public.dealsafe_listing_attributes for select to authenticated
  using (exists (select 1 from public.dealsafe_listings l where l.id = listing_id));
drop policy if exists dealsafe_listing_attributes_write on public.dealsafe_listing_attributes;
create policy dealsafe_listing_attributes_write on public.dealsafe_listing_attributes for all to authenticated
  using (exists (select 1 from public.dealsafe_listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.dealsafe_listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Listing photos (public bucket, own folder only, images up to 5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('market-media', 'market-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
do $$
declare b text := 'market-media';
begin
  execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
  execute format($p$create policy %I on storage.objects for insert to authenticated
    with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_insert_own', b);
  execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
  execute format($p$create policy %I on storage.objects for delete to authenticated
    using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_delete_own', b);
end $$;
