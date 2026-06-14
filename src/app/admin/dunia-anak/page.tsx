import Link from "next/link";
import { Sparkles, Wallet, Star, Flame } from "lucide-react";
import { getChildren } from "@/app/actions/anak-overview";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { Progress } from "@/components/ui/progress";
import { formatRupiah } from "@/lib/format";

export default async function DuniaAnakPage() {
  const children = await getChildren();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-ink-1 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" /> Dunia Anak
        </h1>
        <p className="text-sm text-ink-2">Pilih anak untuk kelola tugas, investasi, dan lainnya.</p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
          Belum ada profil anak.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => {
            const xpPercent = child.xpNextLevel > 0 ? Math.min(100, Math.round((child.xp / child.xpNextLevel) * 100)) : 0;
            return (
              <Link
                key={child.id}
                href={`/admin/dunia-anak/${child.id}`}
                className="block rounded-2xl border-2 border-border bg-card shadow-card p-4 active:translate-y-[2px] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <AvatarDisplay src={child.avatarUrl ?? child.photoUrl} name={child.name} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading font-extrabold text-ink-1 truncate">{child.name}</p>
                      <span className="text-xs font-bold text-ink-3 shrink-0">Level {child.level}</span>
                    </div>
                    <Progress value={xpPercent} className="h-2 mt-1" />
                    <p className="text-xs text-ink-3 mt-0.5">
                      {child.xp} / {child.xpNextLevel} XP
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-xl bg-secondary-light p-2">
                    <Wallet className="w-4 h-4 text-secondary mx-auto mb-0.5" />
                    <p className="font-heading font-extrabold text-sm text-ink-1">{formatRupiah(child.saldo)}</p>
                  </div>
                  <div className="rounded-xl bg-accent-light p-2">
                    <Star className="w-4 h-4 text-accent mx-auto mb-0.5" />
                    <p className="font-heading font-extrabold text-sm text-ink-1">{child.point} pt</p>
                  </div>
                  <div className="rounded-xl bg-yellow/20 p-2">
                    <Flame className="w-4 h-4 text-yellow-dark mx-auto mb-0.5" />
                    <p className="font-heading font-extrabold text-sm text-ink-1">{child.streakDays}/7 hari</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
