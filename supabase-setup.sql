-- ============================================
-- 📦 入庫管理系統 - Supabase 資料庫設定
-- 請在 Supabase Dashboard → SQL Editor 中執行
-- ============================================

-- 1️⃣ 建立 boxes 表
create table if not exists public.boxes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text default '',
  color text default '#3B82F6',
  created_at timestamptz default now()
);

-- 2️⃣ 建立 items 表
create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  box_id uuid references public.boxes(id) on delete cascade not null,
  name text not null,
  note text,
  qty integer default 1,
  photo_url text,
  photo_path text,
  created_at timestamptz default now()
);

-- 3️⃣ 建立索引（加速查詢）
create index if not exists idx_items_box_id on public.items(box_id);

-- 4️⃣ 啟用 RLS（Row Level Security）
alter table public.boxes enable row level security;
alter table public.items enable row level security;

-- 5️⃣ 建立公開存取政策（允許任何人讀寫）
-- ⚠️ 這是最簡單的設定，適合個人使用
-- 如需要多使用者權限控制，之後可改為 auth-based 政策

-- boxes 政策
create policy "Allow public read boxes" on public.boxes
  for select using (true);

create policy "Allow public insert boxes" on public.boxes
  for insert with check (true);

create policy "Allow public update boxes" on public.boxes
  for update using (true);

create policy "Allow public delete boxes" on public.boxes
  for delete using (true);

-- items 政策
create policy "Allow public read items" on public.items
  for select using (true);

create policy "Allow public insert items" on public.items
  for insert with check (true);

create policy "Allow public update items" on public.items
  for update using (true);

create policy "Allow public delete items" on public.items
  for delete using (true);

-- 6️⃣ 建立 Storage Bucket（照片存儲）
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

-- 7️⃣ Storage 存取政策
create policy "Allow public upload photos" on storage.objects
  for insert with check (bucket_id = 'item-photos');

create policy "Allow public read photos" on storage.objects
  for select using (bucket_id = 'item-photos');

create policy "Allow public delete photos" on storage.objects
  for delete using (bucket_id = 'item-photos');
