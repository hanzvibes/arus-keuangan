"use client";

import { useCallback, useEffect, useState } from "react";
import { financeApi, type Notification } from "@/data/client/finance-api";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!navigator.onLine) { setLoading(false); return; }
    try { const next = await financeApi.notifications(); setNotifications(next.notifications); setUnreadCount(next.unreadCount); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);
  const markRead = useCallback(async (id: string) => { const next = await financeApi.readNotification({ id }); setUnreadCount(next.unreadCount); setNotifications(rows => rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)); }, []);
  const markAllRead = useCallback(async () => { const next = await financeApi.readNotification({ all: true }); setUnreadCount(next.unreadCount); setNotifications(rows => rows.map(row => ({ ...row, read_at: row.read_at ?? new Date().toISOString() }))); }, []);
  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
