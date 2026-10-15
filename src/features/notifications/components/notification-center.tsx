"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const run = async (action: () => Promise<void>) => { try { await action(); } catch (error) { toast.error(error instanceof Error ? error.message : "Notifikasi belum bisa diperbarui."); } };
  return <div className="notification-center">
    <button aria-label="Notifikasi" className="notification-center-trigger" onClick={() => setOpen(value => !value)}><Bell size={20} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
    {open && <div className="notification-panel" role="dialog" aria-label="Notifikasi">
      <div className="notification-panel-header"><strong>Notifikasi</strong><button onClick={() => void run(markAllRead)} disabled={!unreadCount}><CheckCheck size={16}/> Tandai semua</button></div>
      {loading ? <p>Memuat notifikasi…</p> : notifications.length === 0 ? <p>Belum ada notifikasi.</p> : <ul>{notifications.map(item => <li key={item.id} className={item.read_at ? "read" : "unread"}><button onClick={() => void run(() => markRead(item.id))}><strong>{item.title}</strong><span>{item.body}</span></button></li>)}</ul>}
    </div>}
  </div>;
}
