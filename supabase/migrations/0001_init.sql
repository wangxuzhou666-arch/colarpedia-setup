-- Workplay · M2 初始 schema
--
-- 表结构：
--   profiles  : 跟 auth.users 1:1，存非敏感的展示信息（email 镜像、created_at）
--   sites     : 用户的 wiki 站点。一个用户可以有多个 site（最初限制为 1 个）。
--               data 是整张表单 JSONB（bio + shipped + educations + experiences + photo url 等）
--               slug 全局唯一，用于 workplay.pro/<slug>/ 路由
--               photo_url 指向 Supabase Storage 的 public URL
--
-- RLS 策略：
--   sites SELECT  → anon + authenticated 都能读（wiki 是公开的，URL 一公开任何人都能看）
--   sites INSERT/UPDATE/DELETE → 只有 owner_id = auth.uid() 才能改自己的
--   profiles SELECT → 自己读自己 + admin client（service_role）走后台
--   profiles INSERT → 由 trigger 在 auth.users 插入时自动创建（不暴露给前端）

-- ===== profiles =====

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.profiles enable row level security;

create policy "users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 用户首次登录时自动建 profile（auth.users insert 触发）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== sites =====

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  slug text not null,            -- 全局唯一，如 wang-xue 或 wang-xue-2
  display_name text not null,    -- 用户输入的姓名（"Wang Xue" 或 "王雪"），用于 dashboard 显示
  data jsonb not null,           -- 整张表单数据（包含 bio / shipped / educations / experiences）
  photo_url text,                -- supabase storage 头像 URL，可空
  published_at timestamp with time zone,  -- 第一次 publish 时间，null = 草稿
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create unique index if not exists sites_slug_idx on public.sites(slug);
create index if not exists sites_owner_idx on public.sites(owner_id);

alter table public.sites enable row level security;

-- 任何人都能读（wiki 是公开内容）。这条让动态路由 [slug]/[...page] 用 anon
-- key 也能查到任意 site，无需走 admin client。
create policy "anyone can read sites"
  on public.sites for select
  using (true);

create policy "users can insert their own sites"
  on public.sites for insert
  with check (auth.uid() = owner_id);

create policy "users can update their own sites"
  on public.sites for update
  using (auth.uid() = owner_id);

create policy "users can delete their own sites"
  on public.sites for delete
  using (auth.uid() = owner_id);

-- updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_touch_updated_at on public.sites;
create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===== Storage bucket: portraits =====
-- 头像 bucket，public 读，authenticated 写自己 owner_id 前缀的文件。
-- 用 SQL 创建 storage bucket（不依赖 dashboard 手动创建）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portraits',
  'portraits',
  true,
  3145728,  -- 3 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS（操作 storage.objects 表）
create policy "anyone can read portraits"
  on storage.objects for select
  using (bucket_id = 'portraits');

create policy "users can upload their own portrait"
  on storage.objects for insert
  with check (
    bucket_id = 'portraits'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can update their own portrait"
  on storage.objects for update
  using (
    bucket_id = 'portraits'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete their own portrait"
  on storage.objects for delete
  using (
    bucket_id = 'portraits'
    and auth.uid()::text = (storage.foldername(name))[1]
  );