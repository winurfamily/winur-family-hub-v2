import { notFound } from "next/navigation";
import Link from "next/link";
import { Wallet, Star, Flame, TrendingUp, ListTodo } from "lucide-react";
import { getChildOverview } from "@/app/actions/anak-overview";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { Progress } from "@/components/ui/progress";
import { formatRupiah, formatDate } from "@/lib/format";
import { DAY_LABELS_ID } from "@/lib/constants";
import { TodayTaskCard } from "./_components/today-task-card";

export default async function ChildOverviewPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const overview = await getChildOverview(childId);

  if (!overview) notFound();

  const { profile, streak, todayTasks, activeInvestment } = overview;
  const xpPercent = profile.xpNextLevel > 0 ? Math.min(100, Math.round((profile.xp / profile.xpNextLevel) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <AvatarDisplay src={profile.avatarUrl ?? profile.photoUrl} name={profile.name} size={64} />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-xl text-ink-1">{profile.name}</p>
            <p className="text-sm text-ink-2">Level {profile.level}</p>
            <Progress value={xpPercent} className="h-2 mt-1" />
            <p className="text-xs text-ink-3 mt-0.5">
              {profile.xp} / {profile.xpNextLevel} XP
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary-light p-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-secondary shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink-3">Saldo</p>
              <p className="font-heading font-extrabold text-ink-1">{formatRupiah(profile.saldo)}</p>
            </div>
          </div>
          <div className="rounded-xl bg-accent-light p-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink-3">Point</p>
              <p className="font-heading font-extrabold text-ink-1">{profile.point} pt</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Flame className="w-5 h-5 text-yellow-dark" /> Streak Mingguan
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS_ID.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-extrabold ${
                  streak.dayStatus[i]
                    ? "bg-secondary border-secondary-dark text-secondary-foreground"
                    : "bg-card border-border text-ink-3"
                }`}
              >
                {streak.dayStatus[i] ? "✓" : ""}
              </div>
              <span className="text-[10px] font-bold text-ink-3">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-2">
          {streak.daysComplete} / 7 hari selesai
          {streak.isComplete && !streak.bonusClaimed && (
            <span className="text-secondary font-bold"> • Bonus streak siap diklaim hari Minggu!</span>
          )}
        </p>
      </div>

      {activeInvestment && (
        <Link
          href={`/admin/dunia-anak/${childId}/investasi`}
          className="block rounded-2xl border-2 border-border bg-card shadow-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-extrabold text-ink-1">Investasi Aktif</p>
              <p className="text-sm text-ink-2">
                {formatRupiah(activeInvestment.amount)} • Estimasi +{formatRupiah(activeInvestment.estimatedReturn)}
              </p>
              <p className="text-xs text-ink-3 mt-0.5">
                Jatuh tempo {formatDate(activeInvestment.endAt)}
                {activeInvestment.isDue && <span className="text-primary font-bold"> • Siap dikonfirmasi</span>}
              </p>
            </div>
          </div>
        </Link>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" /> Task & Tugas Hari Ini
          </h2>
          <Link href={`/admin/dunia-anak/${childId}/tugas`} className="text-sm font-bold text-primary">
            Kelola
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
            Belum ada task/tugas hari ini.{" "}
            <Link href={`/admin/dunia-anak/${childId}/tugas`} className="text-primary font-bold">
              Generate sekarang
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {todayTasks.map((task) => (
              <TodayTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
