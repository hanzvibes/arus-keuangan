"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  const run = async (action: () => Promise<void>) => { try { await action(); } catch (error) { toast.error(error instanceof Error ? error.message : "Notifikasi belum bisa diperbarui."); } };
  return <div className="notification-center" ref={rootRef}>
    <button aria-label="Notifikasi" aria-expanded={open} aria-controls="notification-panel" className="notification-center-trigger" onClick={() => setOpen(value => !value)}><Bell size={20} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
    {open && <div id="notification-panel" className="notification-panel" role="dialog" aria-label="Notifikasi">
      <div className="notification-panel-header"><strong>Notifikasi</strong><button onClick={() => void run(markAllRead)} disabled={!unreadCount}><CheckCheck size={16}/> Tandai semua</button></div>
      {loading ? <p>Memuat notifikasi…</p> : notifications.length === 0 ? <p>Belum ada notifikasi.</p> : <ul>{notifications.map(item => <li key={item.id} className={item.read_at ? "read" : "unread"}><button onClick={() => void run(() => markRead(item.id))}><strong>{item.title}</strong><span>{item.body}</span></button></li>)}</ul>}
    </div>}
  </div>;
}
