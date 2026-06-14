"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getNotifications, markNotificationsRead, type NotificationItem } from "@/app/actions/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const NOTIF_ICON: Record<string, string> = {
  task_approved: "✅",
  tugas_approved: "📘",
  task_rejected: "↩️",
  tugas_rejected: "↩️",
  level_up: "⭐",
  unlock_avatar: "🎭",
  unlock_pet: "🐾",
  investment_done: "📈",
  withdrawal_approved: "💰",
  withdrawal_rejected: "🚫",
  point_request_approved: "🎁",
  point_request_rejected: "❌",
  streak_complete: "🔥",
};

interface NotificationBellProps {
  childId: string;
  unreadCount: number;
}

export function NotificationBell({ childId, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(unreadCount);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;

    setLoading(true);
    getNotifications(childId)
      .then(setItems)
      .finally(() => setLoading(false));

    if (unread > 0) {
      setUnread(0);
      startTransition(() => {
        markNotificationsRead(childId);
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => handleOpenChange(true)}
        className="glass-soft relative flex h-11 w-11 items-center justify-center rounded-xl shadow-card transition-transform active:scale-95 sm:h-12 sm:w-12"
      >
        <Bell className="h-5 w-5 text-ink-2" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <SheetContent side="right" className="glass-strong w-full border-l-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-ink-1">🔔 Notifikasi</SheetTitle>
        </SheetHeader>
        <div className="mt-4 max-h-[80vh] space-y-2 overflow-y-auto pb-8">
          {loading && <p className="py-8 text-center text-sm text-ink-2">Memuat...</p>}
          {!loading && items.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-2">Belum ada notifikasi.</p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "glass-soft rounded-2xl p-3",
                !n.read && "border-accent bg-accent/10"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{NOTIF_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-bold text-ink-1">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-ink-2">{n.message}</p>}
                  <p className="mt-1 text-[10px] text-ink-3">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
