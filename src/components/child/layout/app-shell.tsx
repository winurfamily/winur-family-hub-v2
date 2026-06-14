import { WorldBackground } from "@/components/child/world-background";
import { BottomNav } from "@/components/shared/bottom-nav";
import { CHILD_NAV_ITEMS } from "@/lib/constants";
import { GameHeader } from "./game-header";
import { ChildThemeScope } from "./child-theme-scope";

interface ChildAppShellProps {
  childId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  xpNextLevel: number;
  saldo: number;
  point: number;
  unreadCount: number;
  worldTheme?: string | null;
  backgroundUrl?: string | null;
  children: React.ReactNode;
}

/** Shell full-screen Dunia Anak: background dark navy + header game (top bar) + bottom nav (6 menu, semua layar). */
export function ChildAppShell({
  childId,
  name,
  avatarUrl,
  level,
  xp,
  xpNextLevel,
  saldo,
  point,
  unreadCount,
  worldTheme,
  backgroundUrl,
  children,
}: ChildAppShellProps) {
  const basePath = `/child/${childId}`;

  return (
    <div className="child-shell relative flex min-h-screen w-full flex-col safe-top">
      <ChildThemeScope />
      <WorldBackground theme={worldTheme} imageUrl={backgroundUrl} />

      <div className="relative z-10 flex min-h-screen w-full min-w-0 flex-col">
        <GameHeader
          childId={childId}
          name={name}
          avatarUrl={avatarUrl}
          level={level}
          xp={xp}
          xpNextLevel={xpNextLevel}
          saldo={saldo}
          point={point}
          unreadCount={unreadCount}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-3 sm:px-5 lg:px-8 lg:pb-32 lg:pt-4">{children}</main>
      </div>

      <BottomNav items={CHILD_NAV_ITEMS} basePath={basePath} hideOnDesktop={false} />
    </div>
  );
}
