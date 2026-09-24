-- Pocket complete schema. Safe to run again in the Supabase SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  monthly_budget numeric(12,2) check (monthly_budget is null or monthly_budget > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0),
  category text not null check (category in ('Food','Transport','Shopping','Bills','Health','Other')),
  expense_date date not null default current_date,
  note text not null default '' check (char_length(note) <= 2000),
  receipt_path text,
  created_at timestamptz not null default now(),
  check (receipt_path is null or split_part(receipt_path, '/', 1) = user_id::text)
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, expense_date desc);
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Insert own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Read own expenses" on public.expenses;
drop policy if exists "Insert own expenses" on public.expenses;
drop policy if exists "Update own expenses" on public.expenses;
drop policy if exists "Delete own expenses" on public.expenses;
create policy "Read own expenses" on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own expenses" on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own expenses" on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own expenses" on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
revoke all on public.profiles from anon;
revoke all on public.expenses from anon;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name)
select id, coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read own receipts" on storage.objects;
drop policy if exists "Upload own receipts" on storage.objects;
drop policy if exists "Update own receipts" on storage.objects;
drop policy if exists "Delete own receipts" on storage.objects;
create policy "Read own receipts" on storage.objects for select to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own receipts" on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Update own receipts" on storage.objects for update to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own receipts" on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

