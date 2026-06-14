# 03_DATABASE_ERD.md
Project: Winur Family Hub V2
Status: LOCKED

---

## Prinsip
- Tidak ada DELETE — semua archive/status
- RLS: OFF awal, aktif Sprint 6
- Realtime sync via Supabase Realtime

---

## TABEL

### families
```sql
id              uuid PK DEFAULT gen_random_uuid()
name            text NOT NULL DEFAULT 'Winur Family'
setup_complete  boolean DEFAULT false
theme           text DEFAULT 'light'
sound_enabled   boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### profiles
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
role            text CHECK IN ('admin','child')
name            text NOT NULL
pin             text NULL        -- bcrypt. Admin:6digit, Child:4digit. Admin set PIN anak.
age             int NULL
photo_url       text NULL
avatar_base_prompt text NULL     -- deskripsi base karakter untuk AI generate kostum baru
active_avatar_id   uuid FK → avatars(id) NULL
active_pet_id      uuid FK → pets(id) NULL
level           int DEFAULT 1
xp              int DEFAULT 0
xp_next_level   int DEFAULT 20
point           int DEFAULT 0
saldo           numeric(12,2) DEFAULT 0      -- saldo anak (bukan keluarga)
saldo_invested  numeric(12,2) DEFAULT 0      -- sedang diinvestasi (terkunci)
world_theme     text DEFAULT 'sky'
status          text DEFAULT 'active'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### avatars
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
name            text NOT NULL               -- "Daffa Default", "Polisi", "Astronot"
costume         text NULL                   -- deskripsi kostum
image_url       text NOT NULL               -- Supabase Storage, 512x512px
unlock_level    int DEFAULT 1
is_default      boolean DEFAULT false
generated_by    uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### pets
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
name            text NOT NULL
image_url       text NOT NULL               -- 512x512px
sound_url       text NULL
unlock_level    int DEFAULT 5
generated_by    uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### profile_avatars  -- koleksi unlock per anak
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
avatar_id       uuid FK → avatars(id)
unlocked_at     timestamptz DEFAULT now()
```

### profile_pets  -- koleksi unlock per anak
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
pet_id          uuid FK → pets(id)
unlocked_at     timestamptz DEFAULT now()
```

### tasks
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
type            text CHECK IN ('task','tugas')
title           text NOT NULL
description     text NULL
image_url       text NULL                   -- AI generated 512x512px
questions       jsonb NULL
-- tugas: [{ question, options:[a,b,c,d], correct_answer, explanation }]
day_date        date NOT NULL
reward_money    numeric(8,2) DEFAULT 1000
reward_point    int DEFAULT 1
reward_xp       int DEFAULT 1
status          text DEFAULT 'published'
  CHECK IN ('published','taken','submitted','approved','skipped','expired')
user_answers    jsonb NULL
score           int NULL                    -- nilai tugas (dari 5)
taken_at        timestamptz NULL
submitted_at    timestamptz NULL
approved_at     timestamptz NULL
approved_by     uuid FK → profiles(id) NULL
reward_claimed  boolean DEFAULT false       -- sudah diklaim anak?
reward_claimed_at timestamptz NULL
created_by      uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### weekly_streaks
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
week_start      date NOT NULL               -- Senin
week_end        date NOT NULL               -- Minggu
days_complete   int DEFAULT 0               -- 0-7
is_complete     boolean DEFAULT false
bonus_claimed   boolean DEFAULT false
created_at      timestamptz DEFAULT now()
```

### withdrawal_requests  -- tarik dana (hanya Minggu)
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
amount          numeric(12,2) NOT NULL
include_streak_bonus  boolean DEFAULT false
streak_bonus_amount   numeric(12,2) DEFAULT 0
streak_bonus_point    int DEFAULT 0
status          text DEFAULT 'pending' CHECK IN ('pending','approved','rejected')
requested_at    timestamptz DEFAULT now()
reviewed_at     timestamptz NULL
reviewed_by     uuid FK → profiles(id) NULL
note            text NULL
```

### investments
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
amount          numeric(12,2) NOT NULL
return_percent  numeric(5,2) NOT NULL
estimated_return numeric(12,2) NOT NULL
start_at        timestamptz DEFAULT now()
end_at          timestamptz NOT NULL        -- start + 30 hari
status          text DEFAULT 'active' CHECK IN ('active','completed','confirmed')
actual_return   numeric(12,2) NULL
completed_at    timestamptz NULL
confirmed_at    timestamptz NULL
confirmed_by    uuid FK → profiles(id) NULL
created_at      timestamptz DEFAULT now()
```
Rule: 1 aktif per anak. TIDAK BISA dibatalkan.

### point_rewards  -- hadiah di point shop
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
name            text NOT NULL
description     text NULL
image_url       text NULL                   -- AI generated 512x512px
point_cost      int NOT NULL
min_point_unlock int DEFAULT 0             -- locked jika point < ini
is_active       boolean DEFAULT true
created_by      uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### point_requests  -- request tukar hadiah
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
reward_id       uuid FK → point_rewards(id)
point_cost      int NOT NULL               -- snapshot saat request
status          text DEFAULT 'pending' CHECK IN ('pending','approved','rejected')
requested_at    timestamptz DEFAULT now()
reviewed_at     timestamptz NULL
reviewed_by     uuid FK → profiles(id) NULL
```
Point dipotong SETELAH admin approve.

### saldo_transactions  -- semua pergerakan saldo anak
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
type            text CHECK IN (
  'task_claim',        -- klaim reward task
  'streak_bonus',      -- bonus streak
  'withdrawal',        -- tarik dana
  'investment_in',     -- mulai investasi
  'investment_return'  -- hasil investasi
)
amount          numeric(12,2) NOT NULL      -- + masuk, - keluar
balance_after   numeric(12,2) NOT NULL
reference_id    uuid NULL
note            text NULL
created_at      timestamptz DEFAULT now()
```

### notifications
```sql
id              uuid PK DEFAULT gen_random_uuid()
profile_id      uuid FK → profiles(id)
type            text NOT NULL
title           text NOT NULL
message         text NULL
data            jsonb NULL
read            boolean DEFAULT false
created_at      timestamptz DEFAULT now()
```

### audit_logs
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
actor_id        uuid FK → profiles(id)
entity_type     text NOT NULL
entity_id       uuid NULL
action          text NOT NULL
before_value    jsonb NULL
after_value     jsonb NULL
created_at      timestamptz DEFAULT now()
```

---

## KEUANGAN KELUARGA

### pockets
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
name            text NOT NULL
type            text DEFAULT 'custom' CHECK IN ('default','custom')
balance         numeric(12,2) DEFAULT 0
split_percent   numeric(5,2) DEFAULT 0
is_deletable    boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### income
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
source          text NOT NULL
amount          numeric(12,2) NOT NULL
date            date NOT NULL
note            text NULL
created_by      uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### pocket_transfers
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
from_type       text CHECK IN ('main','pocket')
from_pocket_id  uuid FK → pockets(id) NULL
to_pocket_id    uuid FK → pockets(id)
amount          numeric(12,2) NOT NULL
note            text NULL
created_by      uuid FK → profiles(id)
created_at      timestamptz DEFAULT now()
```

### products
```sql
id              uuid PK DEFAULT gen_random_uuid()
family_id       uuid FK → families(id)
name            text NOT NULL
name_normalized text NOT NULL
category        text NULL
last_price      numeric(12,2) DEFAULT 0
avg_price       numeric(12,2) DEFAULT 0
buy_count       int DEFAULT 0
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### shopping_plans, shopping_plan_items, shopping_transactions
-- Sama dengan V1

---

## FORMULAS

### XP
```typescript
function xpNeeded(level: number): number {
  return Math.round(20 * Math.pow(1.4, level - 1))
}
```

### Saldo Tersedia (untuk tarik dana)
```typescript
saldo_tersedia = profile.saldo  // saldo_invested sudah dikurangi saat mulai investasi
```

### Unlock Check (setiap naik level)
```typescript
async function checkUnlocks(profileId: string, newLevel: number) {
  // avatar unlock_level <= newLevel && belum di profile_avatars → insert + notif
  // pet unlock_level <= newLevel && belum di profile_pets → insert + notif
}
```

---

## SEED DATA
```sql
-- families: Winur Family
-- profiles: Ayah(admin,PIN:080820), Mamah(admin,PIN:080820), Daffa(child,5th,PIN:1234), Dio(child,2th,PIN:1234)
-- pockets: Belanja(default), Tabungan(default)
-- avatars: 1 default per anak (is_default=true, unlock_level=1)
-- profile_avatars: default avatar sudah unlock untuk Daffa & Dio
-- weekly_streaks: baris aktif minggu ini untuk Daffa & Dio
```
