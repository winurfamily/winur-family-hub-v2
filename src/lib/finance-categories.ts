import {
  ArrowRightLeft,
  Award,
  Baby,
  Banknote,
  Briefcase,
  Bus,
  Clapperboard,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  MoreHorizontal,
  ReceiptText,
  ShoppingBasket,
  TrendingUp,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORY_LABELS,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/lib/supabase/types";

/**
 * Rupa kategori transaksi — satu sumber kebenaran untuk ikon dan warnanya.
 *
 * Daftar kategori berupa teks polos membuat pemilihan lambat: mata harus
 * membaca setiap baris. Dengan ikon + warna tetap, kategori dikenali sekali
 * lihat, dan rupa yang sama dipakai di grid pemilih, baris riwayat, panel
 * anggaran, serta grafik — jadi "Makanan" selalu terlihat sama di mana pun.
 *
 * Ikon diambil dari lucide-react yang SUDAH menjadi dependensi (SVG, ter-tree
 * shake per ikon), jadi tidak ada aset atau pustaka baru yang ikut diunduh.
 */
export interface CategoryVisual {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Warna isi ikon. */
  fg: string;
  /** Warna latar bulat di belakang ikon. */
  bg: string;
}

const EXPENSE_VISUALS: Record<ExpenseCategory, { Icon: LucideIcon; fg: string; bg: string }> = {
  makanan: { Icon: Utensils, fg: "#e8622f", bg: "#ffeee5" },
  rumah: { Icon: Home, fg: "#c4762d", bg: "#fdf1e0" },
  transportasi: { Icon: Bus, fg: "#3a86c8", bg: "#e6f2fb" },
  anak: { Icon: Baby, fg: "#d6427b", bg: "#ffe9f1" },
  pendidikan: { Icon: GraduationCap, fg: "#5b62c9", bg: "#eceefc" },
  kesehatan: { Icon: HeartPulse, fg: "#d4455a", bg: "#ffe9ec" },
  tagihan: { Icon: ReceiptText, fg: "#0f9384", bg: "#e2f6f3" },
  belanja: { Icon: ShoppingBasket, fg: "#a259c9", bg: "#f6ebfc" },
  hiburan: { Icon: Clapperboard, fg: "#7f5af0", bg: "#efeafe" },
  sosial: { Icon: Users, fg: "#2f9e6f", bg: "#e5f6ee" },
  hadiah: { Icon: Gift, fg: "#e0407c", bg: "#ffe9f2" },
  // Alias lama — tetap punya rupa agar baris lama tidak kehilangan ikonnya.
  belanja_rumah: { Icon: ShoppingBasket, fg: "#a259c9", bg: "#f6ebfc" },
  lainnya: { Icon: MoreHorizontal, fg: "#7c6b74", bg: "#f3edf0" },
};

const INCOME_VISUALS: Record<IncomeCategory, { Icon: LucideIcon; fg: string; bg: string }> = {
  gaji: { Icon: Briefcase, fg: "#2f9e6f", bg: "#e5f6ee" },
  usaha: { Icon: HandCoins, fg: "#c4762d", bg: "#fdf1e0" },
  bonus: { Icon: Award, fg: "#d69b00", bg: "#fdf4dd" },
  hadiah: { Icon: Gift, fg: "#e0407c", bg: "#ffe9f2" },
  investasi: { Icon: TrendingUp, fg: "#3a86c8", bg: "#e6f2fb" },
  lainnya: { Icon: Banknote, fg: "#7c6b74", bg: "#f3edf0" },
};

const FALLBACK: CategoryVisual = {
  key: "lainnya",
  label: "Lainnya",
  Icon: MoreHorizontal,
  fg: "#7c6b74",
  bg: "#f3edf0",
};

/** Rupa satu kategori pengeluaran. Alias lama dipetakan ke kategori aktifnya. */
export function expenseVisual(key: string | null | undefined): CategoryVisual {
  const raw = (key ?? "lainnya") as ExpenseCategory;
  const resolved = (EXPENSE_CATEGORY_ALIASES[raw] ?? raw) as ExpenseCategory;
  const visual = EXPENSE_VISUALS[resolved];
  if (!visual) return FALLBACK;
  return { key: resolved, label: EXPENSE_CATEGORY_LABELS[resolved], ...visual };
}

/** Rupa satu kategori pendapatan. */
export function incomeVisual(key: string | null | undefined): CategoryVisual {
  const raw = (key ?? "lainnya") as IncomeCategory;
  const visual = INCOME_VISUALS[raw];
  if (!visual) return FALLBACK;
  return { key: raw, label: INCOME_CATEGORY_LABELS[raw], ...visual };
}

/** Rupa untuk baris riwayat mana pun, termasuk transfer yang tak berkategori. */
export function ledgerVisual(kind: "income" | "expense" | "transfer", categoryKey: string | null): CategoryVisual {
  if (kind === "transfer") {
    return { key: "transfer", label: "Transfer", Icon: ArrowRightLeft, fg: "#715ac8", bg: "#f1edff" };
  }
  return kind === "income" ? incomeVisual(categoryKey) : expenseVisual(categoryKey);
}

/**
 * Kategori pengeluaran yang boleh dipilih manual.
 *
 * "Belanja" sengaja tidak ada: pengeluaran belanja HANYA lahir dari menu
 * Belanja supaya tidak ada dua jalan masuk untuk hal yang sama. Alias lama
 * juga disembunyikan agar tidak tampil ganda.
 */
export const MANUAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "makanan",
  "tagihan",
  "transportasi",
  "rumah",
  "kesehatan",
  "pendidikan",
  "anak",
  "hiburan",
  "sosial",
  "hadiah",
  "lainnya",
];

export const MANUAL_EXPENSE_VISUALS: CategoryVisual[] = MANUAL_EXPENSE_CATEGORIES.map((key) =>
  expenseVisual(key)
);

export const INCOME_VISUAL_LIST: CategoryVisual[] = (
  Object.keys(INCOME_VISUALS) as IncomeCategory[]
).map((key) => incomeVisual(key));
