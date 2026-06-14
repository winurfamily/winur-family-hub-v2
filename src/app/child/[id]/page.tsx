import { redirect } from "next/navigation";
import { getChildHome } from "@/app/actions/child-home";
import { getChildCollections } from "@/app/actions/child-avatar";
import { ChildWorld } from "@/components/child/world/child-world";
import { costumeKeyFrom } from "@/components/child/world/costume";
import { BUILTIN_THEMES, deriveKind, getDefaultThemeKey } from "@/components/child/world/theme-config";
import { getCustomRoomTheme } from "@/lib/server/room-themes";

export const dynamic = "force-dynamic";

export default async function ChildWorldPage({ params }: { params: { id: string } }) {
  const [home, collections] = await Promise.all([getChildHome(params.id), getChildCollections(params.id)]);
  if (!home) redirect("/");

  const { profile, todayTasks, unreadNotifications } = home;
  const actionable = todayTasks.filter((t) => t.status === "published" || t.status === "taken").length;
  const activeAvatar = collections?.avatars.find((a) => a.active);

  const kind = deriveKind(profile.name, profile.age);
  const themeKey = profile.activeThemeKey ?? getDefaultThemeKey();
  // Tema bawaan langsung dari kode; selain itu coba tema custom (upload admin),
  // fallback ke tema default bila tidak ditemukan.
  const theme =
    BUILTIN_THEMES[themeKey] ?? (await getCustomRoomTheme(params.id, themeKey)) ?? BUILTIN_THEMES[getDefaultThemeKey()];

  return (
    <ChildWorld
      childId={params.id}
      kind={kind}
      name={profile.name}
      level={profile.level}
      xp={profile.xp}
      xpNextLevel={profile.xpNextLevel}
      saldo={profile.saldo}
      point={profile.point}
      avatarUrl={profile.avatarUrl}
      unreadCount={unreadNotifications}
      petUrl={profile.petUrl}
      petName={profile.petName}
      taskBadge={actionable}
      piggyBadge={0}
      initialCostume={costumeKeyFrom(activeAvatar?.costume, activeAvatar?.name)}
      theme={theme}
      investmentProgress={profile.investmentProgressPercent}
    />
  );
}
