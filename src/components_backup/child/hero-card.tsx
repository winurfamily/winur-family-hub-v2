import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { StatsCard } from "@/components/child/layout/stats-card";
import { LevelBadge } from "@/components/child/stat-pills";
import { XpBar } from "@/components/child/xp-bar";
import { formatRupiah, formatNumber } from "@/lib/format";

interface HeroCardProps {
  name: string;
  avatarUrl: string | null;
  petUrl: string | null;
  petName: string | null;
  level: number;
  xp: number;
  xpNextLevel: number;
  todayCompleted: number;
  todayTotal: number;
  saldo: number;
  point: number;
}

/** Hero section utama Beranda: avatar besar, nama + level + XP, saldo & point, dan progress hari ini. */
export function HeroCard({
  name,
  avatarUrl,
  petUrl,
  petName,
  level,
  xp,
  xpNextLevel,
  todayCompleted,
  todayTotal,
  saldo,
  point,
}: HeroCardProps) {
  const percent = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  return (
    <section className="glass-strong relative overflow-hidden rounded-3xl p-4 shadow-card-deep sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        {/* Avatar besar */}
        <div className="relative mx-auto shrink-0 lg:mx-0">
          <AvatarDisplay
            src={avatarUrl}
            color={colorForName(name)}
            name={name}
            size={96}
            className="animate-breathing shadow-card-deep"
          />
          {petUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={petUrl}
              alt={petName ?? "Pet"}
              className="absolute -bottom-2 -right-2 h-11 w-11 animate-pet-bounce rounded-full border-2 border-white bg-white object-cover shadow-card sm:h-12 sm:w-12"
            />
          )}
        </div>

        {/* Nama besar + level + XP + progress hari ini */}
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <h2 className="font-heading text-xl font-extrabold text-ink-1 sm:text-2xl lg:text-3xl">{name}</h2>
            <LevelBadge level={level} className="px-2.5 py-1 text-xs" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <XpBar xp={xp} xpNextLevel={xpNextLevel} className="flex-1" />
            <span className="shrink-0 font-heading text-[10px] font-bold text-ink-2 sm:text-xs">
              {formatNumber(xp)}/{formatNumber(xpNextLevel)} XP
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-extrabold text-ink-2 sm:text-sm">📋 Progress Hari Ini</p>
              <p className="text-xs font-extrabold text-ink-2 sm:text-sm">
                {todayCompleted}/{todayTotal}
              </p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/20 sm:h-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-secondary to-[#8BC34A] transition-all duration-500"
                style={{ width: `${Math.max(percent, todayTotal > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Saldo + Point */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:w-64">
          <StatsCard icon="🪙" label="Saldo" value={formatRupiah(saldo)} accent="primary" />
          <StatsCard icon="⭐" label="Point" value={formatNumber(point)} accent="yellow" />
        </div>
      </div>
    </section>
  );
}
