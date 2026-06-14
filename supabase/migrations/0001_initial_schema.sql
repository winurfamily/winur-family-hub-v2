-- Winur Family Hub V2 — Initial Schema
-- Prinsip: tidak ada DELETE (semua archive/status), RLS OFF awal (aktif Sprint 6)

create extension if not exists "pgcrypto";

-- =========================================================
-- FAMILIES
-- =========================================================
create table families (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Winur Family',
  setup_complete  boolean default false,
  theme           text default 'light',
  sound_enabled   boolean default true,
  created_at      timestamptz default now()
);

-- =========================================================
-- PROFILES
-- =========================================================
create table profiles (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id),
  role                text not null check (role in ('admin','child')),
  name                text not null,
  pin                 text,                      -- bcrypt. Admin:6digit, Child:4digit
  age                 int,
  photo_url           text,
  avatar_base_prompt  text,
  active_avatar_id    uuid,                      -- FK ditambahkan setelah tabel avatars dibuat
  active_pet_id       uuid,                      -- FK ditambahkan setelah tabel pets dibuat
  level               int default 1,
  xp                  int default 0,
  xp_next_level       int default 20,
  point               int default 0 check (point >= 0),
  saldo               numeric(12,2) default 0 check (saldo >= 0),
  saldo_invested      numeric(12,2) default 0 check (saldo_invested >= 0),
  world_theme         text default 'sky',
  status              text default 'active',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- =========================================================
-- AVATARS
-- =========================================================
create table avatars (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  name            text not null,
  costume         text,
  image_url       text not null,
  unlock_level    int default 1,
  is_default      boolean default false,
  generated_by    uuid references profiles(id),
  created_at      timestamptz default now()
);

-- =========================================================
-- PETS
-- =========================================================
create table pets (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  name            text not null,
  image_url       text not null,
  sound_url       text,
  unlock_level    int default 5,
  generated_by    uuid references profiles(id),
  created_at      timestamptz default now()
);

-- Tambahkan FK profiles -> avatars / pets (circular dependency)
alter table profiles
  add constraint profiles_active_avatar_id_fkey foreign key (active_avatar_id) references avatars(id),
  add constraint profiles_active_pet_id_fkey foreign key (active_pet_id) references pets(id);

-- =========================================================
-- PROFILE_AVATARS (koleksi unlock per anak)
-- =========================================================
create table profile_avatars (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  avatar_id       uuid not null references avatars(id),
  unlocked_at     timestamptz default now(),
  unique (profile_id, avatar_id)
);

-- =========================================================
-- PROFILE_PETS (koleksi unlock per anak)
-- =========================================================
create table profile_pets (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  pet_id          uuid not null references pets(id),
  unlocked_at     timestamptz default now(),
  unique (profile_id, pet_id)
);

-- =========================================================
-- TASKS (task & tugas)
-- =========================================================
create table tasks (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id),
  type                text not null check (type in ('task','tugas')),
  title               text not null,
  description         text,
  image_url           text,
  questions           jsonb,
  day_date            date not null,
  reward_money        numeric(8,2) default 1000,
  reward_point        int default 1,
  reward_xp           int default 1,
  status              text not null default 'published'
    check (status in ('published','taken','submitted','approved','skipped','expired')),
  user_answers        jsonb,
  score               int,
  taken_at            timestamptz,
  submitted_at        timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references profiles(id),
  reward_claimed      boolean default false,
  reward_claimed_at   timestamptz,
  created_by          uuid references profiles(id),
  created_at          timestamptz default now()
);

create index idx_tasks_profile_day on tasks(profile_id, day_date);

-- =========================================================
-- WEEKLY_STREAKS
-- =========================================================
create table weekly_streaks (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  week_start      date not null,
  week_end        date not null,
  days_complete   int default 0 check (days_complete between 0 and 7),
  is_complete     boolean default false,
  bonus_claimed   boolean default false,
  created_at      timestamptz default now(),
  unique (profile_id, week_start)
);

-- =========================================================
-- WITHDRAWAL_REQUESTS (tarik dana, hanya Minggu)
-- =========================================================
create table withdrawal_requests (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references profiles(id),
  amount                  numeric(12,2) not null check (amount > 0),
  include_streak_bonus    boolean default false,
  streak_bonus_amount     numeric(12,2) default 0,
  streak_bonus_point      int default 0,
  status                  text default 'pending' check (status in ('pending','approved','rejected')),
  requested_at            timestamptz default now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid references profiles(id),
  note                    text
);

-- =========================================================
-- INVESTMENTS (1 aktif per anak, tidak bisa dibatalkan)
-- =========================================================
create table investments (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id),
  amount              numeric(12,2) not null check (amount > 0),
  return_percent      numeric(5,2) not null,
  estimated_return    numeric(12,2) not null,
  start_at            timestamptz default now(),
  end_at              timestamptz not null,
  status              text default 'active' check (status in ('active','completed','confirmed')),
  actual_return       numeric(12,2),
  completed_at        timestamptz,
  confirmed_at        timestamptz,
  confirmed_by        uuid references profiles(id),
  created_at          timestamptz default now()
);

-- Hanya boleh ada 1 investasi 'active' per anak
create unique index idx_investments_one_active_per_profile
  on investments(profile_id)
  where status = 'active';

-- =========================================================
-- POINT_REWARDS (hadiah point shop)
-- =========================================================
create table point_rewards (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id),
  name              text not null,
  description       text,
  image_url         text,
  point_cost        int not null check (point_cost >= 0),
  min_point_unlock  int default 0,
  is_active         boolean default true,
  created_by        uuid references profiles(id),
  created_at        timestamptz default now()
);

-- =========================================================
-- POINT_REQUESTS (request tukar hadiah)
-- =========================================================
create table point_requests (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  reward_id       uuid not null references point_rewards(id),
  point_cost      int not null,
  status          text default 'pending' check (status in ('pending','approved','rejected')),
  requested_at    timestamptz default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references profiles(id)
);

-- =========================================================
-- SALDO_TRANSACTIONS (semua pergerakan saldo anak)
-- =========================================================
create table saldo_transactions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  type            text not null check (type in (
    'task_claim',
    'streak_bonus',
    'withdrawal',
    'investment_in',
    'investment_return'
  )),
  amount          numeric(12,2) not null,
  balance_after   numeric(12,2) not null,
  reference_id    uuid,
  note            text,
  created_at      timestamptz default now()
);

create index idx_saldo_transactions_profile on saldo_transactions(profile_id, created_at desc);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id),
  type            text not null,
  title           text not null,
  message         text,
  data            jsonb,
  read            boolean default false,
  created_at      timestamptz default now()
);

create index idx_notifications_profile on notifications(profile_id, read, created_at desc);

-- =========================================================
-- AUDIT_LOGS
-- =========================================================
create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  actor_id        uuid references profiles(id),
  entity_type     text not null,
  entity_id       uuid,
  action          text not null,
  before_value    jsonb,
  after_value     jsonb,
  created_at      timestamptz default now()
);

create index idx_audit_logs_family on audit_logs(family_id, created_at desc);

-- =========================================================
-- KEUANGAN KELUARGA
-- =========================================================
create table pockets (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  name            text not null,
  type            text default 'custom' check (type in ('default','custom')),
  balance         numeric(12,2) default 0 check (balance >= 0),
  split_percent   numeric(5,2) default 0,
  is_deletable    boolean default true,
  created_at      timestamptz default now()
);

create table income (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  source          text not null,
  amount          numeric(12,2) not null check (amount > 0),
  date            date not null,
  note            text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

create table pocket_transfers (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  from_type       text not null check (from_type in ('main','pocket')),
  from_pocket_id  uuid references pockets(id),
  to_pocket_id    uuid not null references pockets(id),
  amount          numeric(12,2) not null check (amount > 0),
  note            text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id),
  name              text not null,
  name_normalized   text not null,
  category          text,
  last_price        numeric(12,2) default 0,
  avg_price         numeric(12,2) default 0,
  buy_count         int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (family_id, name_normalized)
);

-- Rencana belanja
create table shopping_plans (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id),
  name              text not null,
  planned_date      date,
  status            text default 'planned' check (status in ('planned','done','archived')),
  total_estimated   numeric(12,2) default 0,
  total_actual      numeric(12,2) default 0,
  created_by        uuid references profiles(id),
  created_at        timestamptz default now()
);

create table shopping_plan_items (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references shopping_plans(id),
  product_id        uuid references products(id),
  name              text not null,
  qty               int default 1,
  estimated_price   numeric(12,2) default 0,
  actual_price      numeric(12,2),
  checked           boolean default false,
  created_at        timestamptz default now()
);

-- Riwayat belanja (real)
create table shopping_transactions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  plan_id         uuid references shopping_plans(id),
  pocket_id       uuid references pockets(id),
  product_id      uuid references products(id),
  name            text not null,
  qty             int default 1,
  price           numeric(12,2) not null,
  total           numeric(12,2) not null,
  date            date not null default current_date,
  source          text default 'manual' check (source in ('manual','scan','plan')),
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

create index idx_shopping_transactions_family on shopping_transactions(family_id, date desc);
