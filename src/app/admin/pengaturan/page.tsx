import Link from "next/link";
import { ChevronRight, HardDrive, Settings2, Sparkles, Users } from "lucide-react";
import { getCurrentSession } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LINKS = [
  {
    href: "/admin/dunia-anak/settings",
    title: "Pengaturan Dunia Anak",
    note: "PIN anak, reward default, streak, dan profil anak.",
    icon: Sparkles,
  },
  {
    href: "/admin/pengaturan/storage",
    title: "Penyimpanan Struk",
    note: "Pemakaian Supabase Storage dan pembersihan file lepas.",
    icon: HardDrive,
  },
  {
    href: "/admin/dunia-anak/assets",
    title: "Aset Avatar & Pet",
    note: "Kelola avatar, pet, dan tema kamar anak.",
    icon: Users,
  },
];

export default async function PengaturanPage() {
  const session = await getCurrentSession();
  const supabase = createAdminClient();

  const [{ data: family }, { data: profile }] = await Promise.all([
    supabase.from("families").select("name").eq("id", session?.familyId ?? "").maybeSingle(),
    supabase.from("profiles").select("name, role").eq("id", session?.profileId ?? "").maybeSingle(),
  ]);

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] bg-rose-hero p-5 text-white shadow-card">
        <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Keluarga</p>
        <h1 className="mt-1 font-heading text-2xl font-black">{family?.name ?? "Winur Family"}</h1>
        <p className="mt-1 text-xs font-semibold text-white/80">
          Masuk sebagai {profile?.name ?? "Admin"} · {profile?.role === "admin" ? "Orang tua" : "Anak"}
        </p>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-3 rounded-[22px] bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[15px] font-black text-ink-1">{link.title}</span>
                  <span className="block text-[11px] font-semibold text-ink-3">{link.note}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-2 rounded-[22px] bg-surface-2 p-4 text-[11px] font-semibold leading-relaxed text-ink-3">
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Anggaran bulanan dan daftar kategori transaksi diatur di menu Keuangan → tab Anggaran, agar
        tetap satu tempat dengan angka yang dipengaruhinya.
      </p>
    </div>
  );
}
