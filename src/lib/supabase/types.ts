// Database types — Winur Family Hub V2
// Sumber kebenaran: Docs/03_DATABASE_ERD.md (V2, LOCKED) +
// supabase/migrations/0001_initial_schema.sql + 0002_settings_columns.sql.
// Update manual jika skema berubah (tambah migration baru).

type Helper<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRole = "admin" | "child";
export type TaskType = "task" | "tugas";
export type TaskStatus =
  | "published"
  | "taken"
  | "submitted"
  | "approved"
  | "skipped"
  | "expired";
export type PocketType = "default" | "custom";
export type PocketTransferFromType = "main" | "pocket";
export type PocketTransferToType = "main" | "pocket" | "external";
export type InvestmentStatus = "active" | "completed" | "confirmed";
export type WithdrawalStatus = "pending" | "approved" | "rejected";
export type PointRequestStatus = "pending" | "approved" | "rejected";
export type ShoppingPlanStatus = "planned" | "done" | "archived";
export type ShoppingTransactionSource = "manual" | "scan" | "plan";
export type SaldoTransactionType =
  | "task_claim"
  | "streak_bonus"
  | "withdrawal"
  | "investment_in"
  | "investment_return";

export type TugasQuestion = {
  question: string;
  options: [string, string, string, string];
  correct_answer: number; // index 0-3
  explanation: string;
};

export type FamilyRow = {
  id: string;
  name: string;
  setup_complete: boolean;
  theme: string;
  sound_enabled: boolean;
  default_task_money: number;
  default_task_point: number;
  default_task_xp: number;
  default_tugas_money: number;
  default_tugas_point: number;
  default_tugas_xp: number;
  streak_bonus_money: number;
  streak_bonus_point: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  family_id: string;
  role: ProfileRole;
  name: string;
  pin: string | null;
  age: number | null;
  photo_url: string | null;
  avatar_base_prompt: string | null;
  active_avatar_id: string | null;
  active_pet_id: string | null;
  level: number;
  xp: number;
  xp_next_level: number;
  point: number;
  saldo: number;
  saldo_invested: number;
  invest_return_percent: number;
  world_theme: string;
  background_url: string | null;
  sound_settings: SoundSettings;
  active_theme_key: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export interface SoundSettings {
  bgmVolume?: number;
  sfxVolume?: number;
  isMuted?: boolean;
}

/** Tema kamar custom (upload admin) — V3 redesign BAGIAN 2. */
export type RoomThemeRow = {
  id: string;
  owner_profile_id: string;
  name: string;
  day_image_url: string;
  night_image_url: string;
  config: Record<string, unknown>;
  unlock_level: number;
  created_at: string;
};

export type AvatarRow = {
  id: string;
  family_id: string;
  name: string;
  costume: string | null;
  image_url: string;
  unlock_level: number;
  is_default: boolean;
  generated_by: string | null;
  created_at: string;
};

export type PetRow = {
  id: string;
  family_id: string;
  name: string;
  style: string | null;
  image_url: string;
  sound_url: string | null;
  unlock_level: number;
  generated_by: string | null;
  created_at: string;
};

export type ProfileAvatarRow = {
  id: string;
  profile_id: string;
  avatar_id: string;
  unlocked_at: string;
};

export type ProfilePetRow = {
  id: string;
  profile_id: string;
  pet_id: string;
  unlocked_at: string;
};

export type TaskRow = {
  id: string;
  profile_id: string;
  type: TaskType;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  questions: TugasQuestion[] | null;
  day_date: string;
  reward_money: number;
  reward_point: number;
  reward_xp: number;
  status: TaskStatus;
  user_answers: number[] | null;
  score: number | null;
  taken_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  reward_claimed: boolean;
  reward_claimed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type WeeklyStreakRow = {
  id: string;
  profile_id: string;
  week_start: string;
  week_end: string;
  days_complete: number;
  is_complete: boolean;
  bonus_claimed: boolean;
  created_at: string;
};

export type WithdrawalRequestRow = {
  id: string;
  profile_id: string;
  amount: number;
  include_streak_bonus: boolean;
  streak_bonus_amount: number;
  streak_bonus_point: number;
  status: WithdrawalStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  note: string | null;
};

export type InvestmentRow = {
  id: string;
  profile_id: string;
  amount: number;
  return_percent: number;
  estimated_return: number;
  start_at: string;
  end_at: string;
  status: InvestmentStatus;
  actual_return: number | null;
  completed_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
};

export type PointRewardRow = {
  id: string;
  family_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  point_cost: number;
  min_point_unlock: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type PointRequestRow = {
  id: string;
  profile_id: string;
  reward_id: string;
  point_cost: number;
  status: PointRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type SaldoTransactionRow = {
  id: string;
  profile_id: string;
  type: SaldoTransactionType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  family_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
};

export type PocketRow = {
  id: string;
  family_id: string;
  name: string;
  type: PocketType;
  balance: number;
  created_at: string;
};

export type IncomeRow = {
  id: string;
  family_id: string;
  source: string;
  amount: number;
  date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type PocketTransferRow = {
  id: string;
  family_id: string;
  from_type: PocketTransferFromType;
  from_pocket_id: string | null;
  to_type: PocketTransferToType;
  to_pocket_id: string | null;
  amount: number;
  note: string | null;
  income_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProductRow = {
  id: string;
  family_id: string;
  name: string;
  name_normalized: string;
  category: string | null;
  last_price: number;
  avg_price: number;
  buy_count: number;
  created_at: string;
  updated_at: string;
};

export type ShoppingPlanRow = {
  id: string;
  family_id: string;
  name: string;
  planned_date: string | null;
  status: ShoppingPlanStatus;
  total_estimated: number;
  total_actual: number;
  created_by: string | null;
  created_at: string;
};

export type ShoppingPlanItemRow = {
  id: string;
  plan_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  estimated_price: number;
  actual_price: number | null;
  checked: boolean;
  created_at: string;
};

export type ShoppingTransactionRow = {
  id: string;
  family_id: string;
  plan_id: string | null;
  pocket_id: string | null;
  product_id: string | null;
  name: string;
  qty: number;
  price: number;
  total: number;
  date: string;
  source: ShoppingTransactionSource;
  created_by: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      families: Helper<
        FamilyRow,
        | "id"
        | "setup_complete"
        | "theme"
        | "sound_enabled"
        | "default_task_money"
        | "default_task_point"
        | "default_task_xp"
        | "default_tugas_money"
        | "default_tugas_point"
        | "default_tugas_xp"
        | "streak_bonus_money"
        | "streak_bonus_point"
        | "created_at"
      >;
      profiles: Helper<
        ProfileRow,
        | "id"
        | "pin"
        | "age"
        | "photo_url"
        | "avatar_base_prompt"
        | "active_avatar_id"
        | "active_pet_id"
        | "level"
        | "xp"
        | "xp_next_level"
        | "point"
        | "saldo"
        | "saldo_invested"
        | "invest_return_percent"
        | "world_theme"
        | "background_url"
        | "sound_settings"
        | "active_theme_key"
        | "status"
        | "created_at"
        | "updated_at"
      >;
      avatars: Helper<AvatarRow, "id" | "costume" | "unlock_level" | "is_default" | "generated_by" | "created_at">;
      pets: Helper<PetRow, "id" | "style" | "sound_url" | "unlock_level" | "generated_by" | "created_at">;
      profile_avatars: Helper<ProfileAvatarRow, "id" | "unlocked_at">;
      profile_pets: Helper<ProfilePetRow, "id" | "unlocked_at">;
      tasks: Helper<
        TaskRow,
        | "id"
        | "description"
        | "image_url"
        | "questions"
        | "reward_money"
        | "reward_point"
        | "reward_xp"
        | "status"
        | "user_answers"
        | "score"
        | "taken_at"
        | "submitted_at"
        | "approved_at"
        | "approved_by"
        | "reward_claimed"
        | "reward_claimed_at"
        | "created_by"
        | "created_at"
      >;
      weekly_streaks: Helper<
        WeeklyStreakRow,
        "id" | "days_complete" | "is_complete" | "bonus_claimed" | "created_at"
      >;
      withdrawal_requests: Helper<
        WithdrawalRequestRow,
        | "id"
        | "include_streak_bonus"
        | "streak_bonus_amount"
        | "streak_bonus_point"
        | "status"
        | "requested_at"
        | "reviewed_at"
        | "reviewed_by"
        | "note"
      >;
      investments: Helper<
        InvestmentRow,
        | "id"
        | "start_at"
        | "status"
        | "actual_return"
        | "completed_at"
        | "confirmed_at"
        | "confirmed_by"
        | "created_at"
      >;
      point_rewards: Helper<
        PointRewardRow,
        | "id"
        | "description"
        | "image_url"
        | "min_point_unlock"
        | "is_active"
        | "created_by"
        | "created_at"
      >;
      point_requests: Helper<
        PointRequestRow,
        "id" | "status" | "requested_at" | "reviewed_at" | "reviewed_by"
      >;
      saldo_transactions: Helper<
        SaldoTransactionRow,
        "id" | "reference_id" | "note" | "created_at"
      >;
      notifications: Helper<
        NotificationRow,
        "id" | "message" | "data" | "read" | "created_at"
      >;
      audit_logs: Helper<
        AuditLogRow,
        "id" | "actor_id" | "entity_id" | "before_value" | "after_value" | "created_at"
      >;
      pockets: Helper<PocketRow, "id" | "type" | "balance" | "created_at">;
      income: Helper<IncomeRow, "id" | "note" | "created_by" | "created_at">;
      pocket_transfers: Helper<
        PocketTransferRow,
        "id" | "from_pocket_id" | "to_type" | "to_pocket_id" | "note" | "income_id" | "created_by" | "created_at"
      >;
      products: Helper<
        ProductRow,
        "id" | "category" | "last_price" | "avg_price" | "buy_count" | "created_at" | "updated_at"
      >;
      shopping_plans: Helper<
        ShoppingPlanRow,
        "id" | "planned_date" | "status" | "total_estimated" | "total_actual" | "created_by" | "created_at"
      >;
      shopping_plan_items: Helper<
        ShoppingPlanItemRow,
        "id" | "product_id" | "qty" | "estimated_price" | "actual_price" | "checked" | "created_at"
      >;
      shopping_transactions: Helper<
        ShoppingTransactionRow,
        "id" | "plan_id" | "pocket_id" | "product_id" | "qty" | "date" | "source" | "created_by" | "created_at"
      >;
      room_themes: Helper<RoomThemeRow, "id" | "created_at">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
