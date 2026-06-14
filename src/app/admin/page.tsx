import Link from "next/link";
import { getFinanceSummary, getIncomeHistory } from "@/app/actions/keuangan";
import { getChildren } from "@/app/actions/anak-overview";
import { formatRupiah, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHILD_ACCENTS = [
  { color: "#4CAF50", bg: "#E8F5E9", emoji: "🧒" },
  { color: "#7C3AED", bg: "#EDE9FE", emoji: "👦" },
  { color: "#1976D2", bg: "#E3F2FD", emoji: "🧑" },
  { color: "#FF6B9D", bg: "#FCE4EC", emoji: "🧒" },
];

export default async function AdminHomePage() {
  const [summary, children, incomes] = await Promise.all([
    getFinanceSummary(),
    getChildren(),
    getIncomeHistory(3),
  ]);

  const today = formatDate(new Date());

  const channels = [
    {
      href: "/admin/keuangan",
      name: "Keuangan",
      sub: "Saldo, pocket, transfer",
      icon: "💰",
      color: "#2E7D32",
      bg: "#E8F5E9",
    },
    {
      href: "/admin/keuangan/belanja",
      name: "Belanja",
      sub: "Scan struk & rencana",
      icon: "🛒",
      color: "#F57C00",
      bg: "#FFF3E0",
    },
    {
      href: "/admin/dunia-anak",
      name: "Dunia Anak",
      sub: "Task, saldo, avatar",
      icon: "✨",
      color: "#7C3AED",
      bg: "#EDE9FE",
    },
    {
      href: "/admin/dunia-anak/point-shop",
      name: "Point Shop",
      sub: "Hadiah & persetujuan",
      icon: "🎁",
      color: "#1976D2",
      bg: "#E3F2FD",
    },
    {
      href: "/admin/dunia-anak/assets",
      name: "Assets",
      sub: "Karakter & item anak",
      icon: "🧩",
      color: "#E65100",
      bg: "#FFF3E0",
    },
    {
      href: "/admin/dunia-anak/settings",
      name: "Pengaturan",
      sub: "PIN, profil, reward",
      icon: "⚙️",
      color: "#5A5F6E",
      bg: "#ECEEF2",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="font-heading text-2xl font-black text-ink-1">Selamat datang 👋</h1>
        <p className="text-xs font-semibold text-ink-3">{today}</p>
      </div>

      {/* Hero strip */}
      <div className="flex flex-col gap-4 rounded-[22px] bg-[linear-gradient(120deg,#1C1E26,#343948)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-white/55">SALDO KELUARGA</p>
          <p className="mt-1 font-mono text-3xl font-bold">
            {formatRupiah(summary?.saldoUtama ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {children.map((c, i) => {
            const a = CHILD_ACCENTS[i % CHILD_ACCENTS.length];
            return (
              <div key={c.id} className="flex items-center gap-2 text-xs font-bold">
                <span>{a.emoji} {c.name}</span>
                <span className="flex gap-[3px]">
                  {Array.from({ length: 7 }).map((_, d) => (
                    <span
                      key={d}
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: d < c.streakDays ? a.color : "rgba(255,255,255,.2)",
                      }}
                    />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Channels */}
      <div>
        <p className="mb-2 text-[11px] font-extrabold tracking-[1px] text-ink-3">MENU KELUARGA</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {channels.map((ch) => (
            <Link
              key={ch.href + ch.name}
              href={ch.href}
              style={{ color: ch.color }}
              className="group relative flex h-[126px] flex-col justify-between rounded-[20px] border-[2.5px] border-transparent bg-card p-3.5 shadow-card transition-all hover:-translate-y-1 hover:border-[color:currentColor]"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-[13px] text-xl"
                style={{ background: ch.bg }}
              >
                {ch.icon}
              </span>
              <span>
                <span className="block font-heading text-[13px] font-black text-ink-1">{ch.name}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-ink-3">{ch.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-[18px] bg-card p-4 shadow-card">
        <p className="mb-2 text-[11px] font-extrabold tracking-[1px] text-ink-3">AKTIVITAS TERBARU</p>
        {incomes.length === 0 ? (
          <p className="py-2 text-center text-xs text-ink-3">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="divide-y divide-border">
            {incomes.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="truncate font-semibold text-ink-2">
                  {item.source} <span className="font-bold text-secondary-dark">+{formatRupiah(item.amount)}</span>
                </span>
                <span className="shrink-0 text-ink-3">{formatDate(item.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
