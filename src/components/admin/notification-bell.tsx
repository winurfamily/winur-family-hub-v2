"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  markAdminNotificationsRead,
  type AdminNotificationItem,
} from "@/app/actions/admin-notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AdminNotificationBellProps {
  initialNotifications: AdminNotificationItem[];
  initialUnreadCount: number;
}

export function AdminNotificationBell({ initialNotifications, initialUnreadCount }: AdminNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }, [initialNotifications, initialUnreadCount]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((items) => items.map((n) => ({ ...n, read: true })));
      void markAdminNotificationsRead();
    }
  };

  const onItemClick = (item: AdminNotificationItem) => {
    setOpen(false);
    const href = item.data?.href as string | undefined;
    if (href) router.push(href);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex h-[42px] w-[42px] items-center justify-center rounded-xl border-2 border-border bg-card shadow-card transition-transform active:scale-95"
        aria-label="Notifikasi"
      >
        <Bell className="h-[18px] w-[18px] text-ink-2" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-black text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl border-2 border-border bg-card p-2 shadow-card">
          <p className="px-2 py-1 font-heading text-xs font-extrabold uppercase tracking-wide text-ink-3">Notifikasi</p>
          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-ink-3">Belum ada notifikasi.</p>
          ) : (
            <div className="max-h-[360px] space-y-1 overflow-y-auto">
              {notifications.map((item) => {
                const href = item.data?.href as string | undefined;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick(item)}
                    disabled={!href}
                    className={cn(
                      "block w-full rounded-xl p-2.5 text-left transition-colors",
                      href ? "active:bg-secondary-light" : "cursor-default",
                      !item.read && "bg-accent-light"
                    )}
                  >
                    <p className="font-heading text-sm font-extrabold text-ink-1">{item.title}</p>
                    {item.message && <p className="mt-0.5 text-xs text-ink-2">{item.message}</p>}
                    <p className="mt-1 text-[11px] text-ink-3">{formatDateTime(item.createdAt)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
