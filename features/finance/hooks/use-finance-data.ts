"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FinanceApiError, financeApi } from "@/data/client/finance-api";
import {
  clearDeviceCache,
  enqueueTransaction,
  readQueue,
  readSnapshot,
  removeQueuedTransaction,
  writeSnapshot,
} from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import type { FinanceData, QueuedTransaction } from "@/domain/finance/types";

const empty: FinanceData = {
  accounts: [],
  transactions: [],
  budgets: [],
  categories: [],
  recurring: [],
};

export function useFinanceData() {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<FinanceData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [queued, setQueued] = useState<QueuedTransaction[]>([]);
  const [stale, setStale] = useState(false);
  const [connected, setConnected] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [syncingQueue, setSyncingQueue] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!active) return;

        if (authError || !authData.user) {
          setError(true);
          setLoading(false);
          return;
        }

        setUserId(authData.user.id);
      } catch {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const reloadQueue = useCallback(async () => {
    if (!userId) return;
    setQueued(await readQueue<QueuedTransaction>(userId));
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;

    try {
      const next = await financeApi.read();
      setData(next);
      void writeSnapshot(userId, next).catch(console.error);
      setStale(false);
      setConnected(true);
      setError(false);
    } catch {
      const cached = await readSnapshot<FinanceData>(userId).catch(() => null);
      if (cached) {
        setData(cached);
        setStale(true);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const syncQueue = useCallback(async () => {
    if (!userId || syncingRef.current || !navigator.onLine) return;

    syncingRef.current = true;
    setSyncingQueue(true);

    try {
      const pending = (await readQueue<QueuedTransaction>(userId))
        .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

      for (const item of pending) {
        const transaction = {
          id: item.id,
          type: item.type,
          amount: item.amount,
          accountId: item.accountId,
          toAccountId: item.toAccountId,
          category: item.category,
          note: item.note,
          date: item.date,
        };

        try {
          await financeApi.save("POST", { ...transaction, entity: "transaction" });
        } catch (syncError) {
          setQueueError(
            syncError instanceof FinanceApiError
              ? syncError.message
              : "Koneksi terputus. Coba kirim lagi saat tersambung.",
          );
          break;
        }

        await removeQueuedTransaction(userId, item.id);
        await reloadQueue();
        setQueueError("");
      }

      if (pending.length) await refresh();
    } catch {
      setQueueError("Koneksi terputus. Coba kirim lagi saat tersambung.");
    } finally {
      syncingRef.current = false;
      setSyncingQueue(false);
    }
  }, [refresh, reloadQueue, userId]);

  useEffect(() => {
    if (!userId) return;
    queueMicrotask(() => void refresh());
    void reloadQueue().catch(console.error);
  }, [refresh, reloadQueue, userId]);

  useEffect(() => {
    if (!userId) return;

    queueMicrotask(() => void syncQueue());

    const onOnline = () => {
      setConnected(true);
      void syncQueue();
      void refresh();
    };
    const onOffline = () => setConnected(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh, syncQueue, userId]);

  const shown = useMemo<FinanceData>(() => ({
    ...data,
    transactions: [
      ...queued.filter(item => !data.transactions.some(saved => saved.id === item.id)),
      ...data.transactions,
    ].sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.queuedAt || b.createdAt || "").localeCompare(a.queuedAt || a.createdAt || ""),
    ),
  }), [data, queued]);

  const requireUserId = useCallback(() => {
    if (!userId) throw new Error("Sesi user belum siap.");
    return userId;
  }, [userId]);

  const queueTransaction = useCallback(async (transaction: QueuedTransaction) => {
    const currentUserId = requireUserId();
    await enqueueTransaction(currentUserId, transaction);
    await reloadQueue();
  }, [reloadQueue, requireUserId]);

  const hasPending = useCallback(async () => {
    const currentUserId = requireUserId();
    return (await readQueue<QueuedTransaction>(currentUserId)).length > 0;
  }, [requireUserId]);

  const hasPendingForAccount = useCallback(async (accountId: string) => {
    const currentUserId = requireUserId();
    return (await readQueue<QueuedTransaction>(currentUserId))
      .some(item => item.accountId === accountId || item.toAccountId === accountId);
  }, [requireUserId]);

  const runExclusive = useCallback(async function runExclusive<T>(
    action: () => Promise<T>,
  ): Promise<T> {
    if (syncingRef.current) throw new Error("SYNC_BUSY");
    syncingRef.current = true;
    try {
      return await action();
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const discardQueued = useCallback(async (id: string) => {
    const currentUserId = requireUserId();

    return runExclusive(async () => {
      if (navigator.onLine) {
        const current = await financeApi.read();
        if (current.transactions.some(item => item.id === id)) {
          await removeQueuedTransaction(currentUserId, id);
          await reloadQueue();
          setData(current);
          void writeSnapshot(currentUserId, current).catch(console.error);
          setQueueError("");
          return "already-synced" as const;
        }
      }

      await removeQueuedTransaction(currentUserId, id);
      await reloadQueue();
      setQueueError("");
      return "discarded" as const;
    });
  }, [reloadQueue, requireUserId, runExclusive]);

  const clearOfflineCache = useCallback(async () => {
    const currentUserId = requireUserId();

    return runExclusive(async () => {
      if (await hasPending()) {
        throw new Error("Selesaikan transaksi tertunda sebelum menghapus data offline.");
      }
      await clearDeviceCache(currentUserId);
    });
  }, [hasPending, requireUserId, runExclusive]);

  return {
    data,
    loading,
    error,
    queued,
    shown,
    offline: stale || !connected,
    queueError,
    syncingQueue,
    refresh,
    syncQueue,
    queueTransaction,
    discardQueued,
    hasPending,
    hasPendingForAccount,
    runExclusive,
    clearOfflineCache,
  };
}
