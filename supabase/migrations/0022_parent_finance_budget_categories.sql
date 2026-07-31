-- Parent finance support: editable categories and monthly budgets.
-- Additive only. No existing finance or child-world table is dropped.

create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  key text not null,
  label text not null,
  icon text not null default 'default',
  color text not null default '#ef5b93',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, kind, key)
);

create table if not exists monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  category_key text,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  alert_75 boolean not null default true,
  alert_90 boolean not null default true,
  alert_100 boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, month, category_key)
);

create index if not exists idx_finance_categories_family_kind
  on finance_categories(family_id, kind, is_active);

create index if not exists idx_monthly_budgets_family_month
  on monthly_budgets(family_id, month);

alter table finance_categories enable row level security;
alter table monthly_budgets enable row level security;

drop policy if exists finance_categories_service_role_all on finance_categories;
create policy finance_categories_service_role_all
  on finance_categories for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists monthly_budgets_service_role_all on monthly_budgets;
create policy monthly_budgets_service_role_all
  on monthly_budgets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function fin_seed_default_categories(p_family_id uuid)
returns void
language plpgsql
as $$
begin
  insert into finance_categories(family_id, kind, key, label, icon, color, is_system)
  values
    (p_family_id, 'expense', 'makanan', 'Makanan', 'food', '#f59e0b', false),
    (p_family_id, 'expense', 'rumah', 'Rumah', 'home', '#60a5fa', false),
    (p_family_id, 'expense', 'transportasi', 'Transportasi', 'transport', '#38bdf8', false),
    (p_family_id, 'expense', 'anak', 'Anak', 'child', '#a78bfa', false),
    (p_family_id, 'expense', 'pendidikan', 'Pendidikan', 'education', '#818cf8', false),
    (p_family_id, 'expense', 'kesehatan', 'Kesehatan', 'health', '#34d399', false),
    (p_family_id, 'expense', 'tagihan', 'Tagihan', 'bill', '#fb7185', false),
    (p_family_id, 'expense', 'belanja', 'Belanja', 'shopping', '#ef5b93', true),
    (p_family_id, 'expense', 'hiburan', 'Hiburan', 'fun', '#f472b6', false),
    (p_family_id, 'expense', 'sosial', 'Sosial', 'social', '#22c55e', false),
    (p_family_id, 'expense', 'hadiah', 'Hadiah', 'gift', '#f97316', false),
    (p_family_id, 'expense', 'lainnya', 'Lainnya', 'default', '#94a3b8', false),
    (p_family_id, 'income', 'gaji', 'Gaji', 'wallet', '#22c55e', false),
    (p_family_id, 'income', 'usaha', 'Usaha', 'store', '#14b8a6', false),
    (p_family_id, 'income', 'bonus', 'Bonus', 'sparkle', '#84cc16', false),
    (p_family_id, 'income', 'hadiah', 'Hadiah', 'gift', '#f59e0b', false),
    (p_family_id, 'income', 'investasi', 'Investasi', 'chart', '#6366f1', false),
    (p_family_id, 'income', 'lainnya', 'Lainnya', 'default', '#94a3b8', false)
  on conflict (family_id, kind, key) do nothing;
end;
$$;

insert into finance_categories(family_id, kind, key, label, icon, color, is_system)
select f.id, seed.kind, seed.key, seed.label, seed.icon, seed.color, seed.is_system
from families f
cross join (
  values
    ('expense', 'belanja', 'Belanja', 'shopping', '#ef5b93', true),
    ('expense', 'lainnya', 'Lainnya', 'default', '#94a3b8', false),
    ('income', 'lainnya', 'Lainnya', 'default', '#94a3b8', false)
) as seed(kind, key, label, icon, color, is_system)
on conflict (family_id, kind, key) do nothing;

grant execute on function fin_seed_default_categories(uuid) to service_role;
