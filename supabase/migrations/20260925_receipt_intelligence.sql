-- Structured receipt data and OCR review metadata.
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,
  merchant_name text not null default '' check (char_length(merchant_name) <= 120),
  receipt_number text not null default '' check (char_length(receipt_number) <= 80),
  tax_id text not null default '' check (char_length(tax_id) <= 20),
  branch text not null default '' check (char_length(branch) <= 100),
  transaction_date date,
  transaction_time time,
  subtotal numeric(12,2) check (subtotal is null or subtotal >= 0),
  discount numeric(12,2) check (discount is null or discount >= 0),
  tax numeric(12,2) check (tax is null or tax >= 0),
  total numeric(12,2) check (total is null or total >= 0),
  payment_method text not null default '' check (char_length(payment_method) <= 60),
  ocr_text text not null default '',
  field_confidence jsonb not null default '{}'::jsonb,
  image_quality jsonb not null default '{}'::jsonb,
  crop_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is null or split_part(storage_path, '/', 1) = user_id::text)
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  line_number integer not null check (line_number >= 0),
  name text not null check (char_length(name) between 1 and 160),
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (receipt_id, line_number)
);

create index if not exists receipts_user_date_idx on public.receipts(user_id, transaction_date desc);
create index if not exists receipt_items_receipt_idx on public.receipt_items(receipt_id, line_number);

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

drop policy if exists "Read own receipt details" on public.receipts;
drop policy if exists "Insert own receipt details" on public.receipts;
drop policy if exists "Update own receipt details" on public.receipts;
drop policy if exists "Delete own receipt details" on public.receipts;
create policy "Read own receipt details" on public.receipts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own receipt details" on public.receipts for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())));
create policy "Update own receipt details" on public.receipts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())));
create policy "Delete own receipt details" on public.receipts for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own receipt items" on public.receipt_items;
drop policy if exists "Insert own receipt items" on public.receipt_items;
drop policy if exists "Update own receipt items" on public.receipt_items;
drop policy if exists "Delete own receipt items" on public.receipt_items;
create policy "Read own receipt items" on public.receipt_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own receipt items" on public.receipt_items for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = (select auth.uid())));
create policy "Update own receipt items" on public.receipt_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = (select auth.uid())));
create policy "Delete own receipt items" on public.receipt_items for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.receipts to authenticated;
grant select, insert, update, delete on public.receipt_items to authenticated;
revoke all on public.receipts from anon;
revoke all on public.receipt_items from anon;

create or replace function public.save_receipt_analysis(
  p_expense_id uuid,
  p_storage_path text,
  p_receipt jsonb,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_receipt_id uuid;
begin
  if current_user_id is null or not exists (
    select 1 from public.expenses where id = p_expense_id and user_id = current_user_id
  ) then
    raise exception 'Expense not found or access denied';
  end if;

  insert into public.receipts (
    expense_id, user_id, storage_path, merchant_name, receipt_number, tax_id, branch,
    transaction_date, transaction_time, subtotal, discount, tax, total, payment_method,
    ocr_text, field_confidence, image_quality, crop_metadata, updated_at
  ) values (
    p_expense_id, current_user_id, p_storage_path,
    coalesce(p_receipt ->> 'merchant_name', ''),
    coalesce(p_receipt ->> 'receipt_number', ''),
    coalesce(p_receipt ->> 'tax_id', ''),
    coalesce(p_receipt ->> 'branch', ''),
    nullif(p_receipt ->> 'transaction_date', '')::date,
    nullif(p_receipt ->> 'transaction_time', '')::time,
    nullif(p_receipt ->> 'subtotal', '')::numeric,
    nullif(p_receipt ->> 'discount', '')::numeric,
    nullif(p_receipt ->> 'tax', '')::numeric,
    nullif(p_receipt ->> 'total', '')::numeric,
    coalesce(p_receipt ->> 'payment_method', ''),
    coalesce(p_receipt ->> 'ocr_text', ''),
    coalesce(p_receipt -> 'field_confidence', '{}'::jsonb),
    coalesce(p_receipt -> 'image_quality', '{}'::jsonb),
    coalesce(p_receipt -> 'crop_metadata', '{}'::jsonb),
    now()
  )
  on conflict (expense_id) do update set
    storage_path = excluded.storage_path,
    merchant_name = excluded.merchant_name,
    receipt_number = excluded.receipt_number,
    tax_id = excluded.tax_id,
    branch = excluded.branch,
    transaction_date = excluded.transaction_date,
    transaction_time = excluded.transaction_time,
    subtotal = excluded.subtotal,
    discount = excluded.discount,
    tax = excluded.tax,
    total = excluded.total,
    payment_method = excluded.payment_method,
    ocr_text = excluded.ocr_text,
    field_confidence = excluded.field_confidence,
    image_quality = excluded.image_quality,
    crop_metadata = excluded.crop_metadata,
    updated_at = now()
  returning id into saved_receipt_id;

  delete from public.receipt_items where receipt_id = saved_receipt_id;

  insert into public.receipt_items (receipt_id, user_id, line_number, name, quantity, unit_price, total, confidence)
  select
    saved_receipt_id,
    current_user_id,
    (entry.ordinality - 1)::integer,
    left(coalesce(entry.value ->> 'name', ''), 160),
    coalesce(nullif(entry.value ->> 'quantity', '')::numeric, 1),
    nullif(entry.value ->> 'unit_price', '')::numeric,
    coalesce(nullif(entry.value ->> 'total', '')::numeric, 0),
    least(1, greatest(0, coalesce(nullif(entry.value ->> 'confidence', '')::numeric, 0)))
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entry(value, ordinality)
  where nullif(trim(entry.value ->> 'name'), '') is not null;

  return saved_receipt_id;
end;
$$;

grant execute on function public.save_receipt_analysis(uuid, text, jsonb, jsonb) to authenticated;
revoke all on function public.save_receipt_analysis(uuid, text, jsonb, jsonb) from anon;
