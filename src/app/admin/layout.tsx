import Link from "next/link";
import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { getCurrentSession } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SwitchProfileButton } from "@/components/shared/switch-profile-button";
import { BgmTrigger } from "@/components/shared/bgm-trigger";
import { AdminNotificationBell } from "@/components/admin/notification-bell";
import { getAdminNotifications, getUnreadAdminNotificationCount } from "@/app/actions/admin-notifications";

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
    <div className="admin-shell min-h-screen bg-background text-ink-1 safe-top">
      <BgmTrigger track={null} />
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3 py-2 shadow-card transition-transform active:scale-95"
          >
            <Home className="h-[18px] w-[18px] text-ink-2" />
            <span className="font-heading text-base font-black leading-none text-ink-1">
              Winur Hub
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-ink-3">
                {profile?.name ?? "Admin"}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <AdminNotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <SwitchProfileButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-5 pb-24">{children}</main>
    </div>
  );
}
