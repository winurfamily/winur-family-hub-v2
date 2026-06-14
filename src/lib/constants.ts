// Konstanta global — Winur Family Hub V2
// Sumber: Docs/01_PRD.md & Docs/06_DECISION_LOG.md

export const REWARD = {
  TASK_MONEY: 1000,
  TASK_POINT: 1,
  TASK_XP: 1,
  TUGAS_MONEY: 2000,
  TUGAS_POINT: 2,
  TUGAS_XP: 2,
  STREAK_BONUS_MONEY: 15000,
  STREAK_BONUS_POINT: 15,
  MAX_TASK_PER_DAY: 3,
  MAX_TUGAS_PER_DAY: 1,
} as const;

export const INVESTMENT = {
  DURATION_DAYS: 30,
  QUICK_AMOUNTS: [10000, 25000, 50000] as const,
};

export const PIN = {
  ADMIN_LENGTH: 6,
  CHILD_LENGTH: 4,
};

export const CHILD_NAV_ITEMS = [
  { key: "beranda", label: "Beranda", icon: "Home", href: "" },
  { key: "investasi", label: "Investasi", icon: "TrendingUp", href: "/investasi" },
  { key: "avatar", label: "Avatar", icon: "User", href: "/avatar" },
  { key: "klaim", label: "Klaim Saldo", icon: "Wallet", href: "/klaim" },
  { key: "shop", label: "Point Shop", icon: "Gift", href: "/shop" },
  { key: "riwayat", label: "Riwayat", icon: "BookOpen", href: "/riwayat" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { key: "keuangan", label: "Keuangan", icon: "Wallet", href: "/admin/keuangan" },
  { key: "dunia-anak", label: "Dunia Anak", icon: "Sparkles", href: "/admin/dunia-anak" },
] as const;

export const DAY_LABELS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

export const WORLD_THEMES = [
  { value: "sky", label: "Langit", emoji: "☁️" },
  { value: "ocean", label: "Laut", emoji: "🌊" },
  { value: "forest", label: "Hutan", emoji: "🌳" },
  { value: "space", label: "Luar Angkasa", emoji: "🚀" },
] as const;

// ---------------------------------------------------------------------------
// Kategori Task & Tugas — mengarahkan AI agar tidak generate ide secara acak,
// dan menentukan ilustrasi default saat admin memilih tanpa gambar AI.
// ---------------------------------------------------------------------------

export type TaskCategory = {
  value: string;
  label: string;
  icon: string;
  gradient: string;
  hint: string;
};

export const TASK_CATEGORIES: TaskCategory[] = [
  {
    value: "kebersihan",
    label: "Kebersihan & Kerapian",
    icon: "Brush",
    gradient: "from-sky-300 to-cyan-400",
    hint: "merapikan kamar, menyapu, mengelap meja, mencuci piring, atau membuang sampah",
  },
  {
    value: "kemandirian",
    label: "Kemandirian",
    icon: "Smile",
    gradient: "from-amber-200 to-orange-400",
    hint: "mandi sendiri, sikat gigi, memakai baju sendiri, merapikan tempat tidur, atau makan sendiri",
  },
  {
    value: "ibadah",
    label: "Ibadah",
    icon: "Moon",
    gradient: "from-indigo-300 to-purple-400",
    hint: "sholat tepat waktu, mengaji, berdoa sebelum makan/tidur, atau bersyukur",
  },
  {
    value: "belajar",
    label: "Belajar",
    icon: "BookOpen",
    gradient: "from-emerald-300 to-green-400",
    hint: "membaca buku, mengerjakan PR, latihan menulis, atau latihan berhitung",
  },
  {
    value: "kesehatan",
    label: "Kesehatan & Olahraga",
    icon: "HeartPulse",
    gradient: "from-rose-300 to-pink-400",
    hint: "olahraga ringan, peregangan, makan sayur dan buah, minum air putih, atau tidur tepat waktu",
  },
  {
    value: "bantu_keluarga",
    label: "Membantu Keluarga",
    icon: "HandHeart",
    gradient: "from-yellow-200 to-amber-400",
    hint: "membantu menyiapkan makan, merawat tanaman, menjaga adik, atau membantu pekerjaan rumah ringan",
  },
];

export const TUGAS_CATEGORIES: TaskCategory[] = [
  {
    value: "matematika",
    label: "Matematika",
    icon: "Calculator",
    gradient: "from-blue-300 to-indigo-400",
    hint: "berhitung, penjumlahan, pengurangan, perkalian, pembagian, atau bentuk geometri sesuai usia",
  },
  {
    value: "sains",
    label: "Sains (IPA)",
    icon: "FlaskConical",
    gradient: "from-teal-300 to-emerald-400",
    hint: "alam sekitar, hewan, tumbuhan, tubuh manusia, atau fenomena alam sederhana",
  },
  {
    value: "bahasa_indonesia",
    label: "Bahasa Indonesia",
    icon: "BookText",
    gradient: "from-red-300 to-rose-400",
    hint: "kosakata, sinonim, antonim, tata bahasa sederhana, atau pemahaman bacaan",
  },
  {
    value: "bahasa_inggris",
    label: "Bahasa Inggris",
    icon: "Languages",
    gradient: "from-violet-300 to-indigo-400",
    hint: "kosakata dasar bahasa Inggris seperti warna, angka, hewan, atau kegiatan sehari-hari",
  },
  {
    value: "pengetahuan_umum",
    label: "Pengetahuan Umum",
    icon: "Globe",
    gradient: "from-cyan-300 to-sky-400",
    hint: "negara, bendera, ibu kota, atau fakta menarik seputar dunia",
  },
  {
    value: "agama",
    label: "Agama & Akhlak",
    icon: "Star",
    gradient: "from-amber-300 to-yellow-400",
    hint: "kisah teladan, akhlak baik, atau pengetahuan agama dasar sesuai usia",
  },
];

export function getTaskCategories(type: "task" | "tugas"): TaskCategory[] {
  return type === "tugas" ? TUGAS_CATEGORIES : TASK_CATEGORIES;
}

export function findTaskCategory(type: "task" | "tugas", value: string | null | undefined): TaskCategory | undefined {
  return getTaskCategories(type).find((c) => c.value === value);
}
