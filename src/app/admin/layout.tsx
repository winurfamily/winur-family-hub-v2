import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SwitchProfileButton } from "@/components/shared/switch-profile-button";
import { BgmTrigger } from "@/components/shared/bgm-trigger";
import { AdminNotificationBell } from "@/components/admin/notification-bell";
import { AdminShell } from "@/components/shell/admin-shell";
import {
  getAdminNotifications,
  getUnreadAdminNotificationCount,
} from "@/app/actions/admin-notifications";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session || session.role !== "admin") {
    redirect("/");
  }

  const supabase = createAdminClient();
  const [{ data: profile }, notifications, unreadCount] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", session.profileId).maybeSingle(),
    getAdminNotifications(),
    getUnreadAdminNotificationCount(),
  ]);

  return (
    <>
      <BgmTrigger track={null} />
      <AdminShell
        profileName={profile?.name ?? "Admin"}
        headerSlot={
          <>
            <AdminNotificationBell
              initialNotifications={notifications}
              initialUnreadCount={unreadCount}
            />
            <SwitchProfileButton iconOnly className="h-[42px] w-[42px]" />
          </>
        }
      >
        {children}
      </AdminShell>
    </>
  );
}
