import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { XpBar } from "@/components/child/xp-bar";
import { LevelBadge, SaldoPill, PointPill } from "@/components/child/stat-pills";
import { NotificationBell } from "@/components/child/notification-bell";
import { SoundToggle } from "@/components/shared/sound-toggle";
import { SwitchProfileButton } from "@/components/shared/switch-profile-button";
import { formatNumber } from "@/lib/format";

interface GameHeaderProps {
  childId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  xpNextLevel: number;
  saldo: number;
  point: number;
  unreadCount: number;
}

/** Header game sticky: avatar + level + XP di kiri, saldo/point + aksi di kanan. */
export function GameHeader({ childId, name, avatarUrl, level, xp, xpNextLevel, saldo, point, unreadCount }: GameHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full px-3 pt-3 sm:px-5 lg:px-8 lg:pt-6">
      <div className="glass-strong flex flex-col gap-3 rounded-2xl p-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarDisplay
            src={avatarUrl}
            color={colorForName(name)}
            name={name}
            size={48}
            className="animate-breathing shadow-card shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-base font-extrabold text-ink-1 sm:text-lg">{name}</h1>
              <LevelBadge level={level} />
            </div>
            <div className="mt-1 flex items-center gap-2 sm:w-56 lg:w-64">
              <XpBar xp={xp} xpNextLevel={xpNextLevel} className="flex-1" />
              <span className="shrink-0 font-heading text-[10px] font-bold text-ink-2">
                {formatNumber(xp)}/{formatNumber(xpNextLevel)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto scroll-no-bar">
            <SaldoPill value={saldo} />
            <PointPill value={point} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell childId={childId} unreadCount={unreadCount} />
            <SoundToggle />
            <SwitchProfileButton iconOnly />
          </div>
        </div>
      </div>
    </header>
  );
}
