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
import type { FinanceData, QueuedTransaction } from "@/domain/finance/types";

const empty: FinanceData = {
  accounts: [],
  transactions: [],
  budgets: [],
  categories: [],
  recurring: [],
};

export function useFinanceData() {
  const [data, setData] = useState<FinanceData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [queued, setQueued] = useState<QueuedTransaction[]>([]);
  const [stale, setStale] = useState(false);
  const [connected, setConnected] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [syncingQueue, setSyncingQueue] = useState(false);
  const syncingRef = useRef(false);

  const reloadQueue = useCallback(async () => {
    setQueued(await readQueue<QueuedTransaction>());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await financeApi.read();
      setData(next);
      void writeSnapshot(next).catch(console.error);
      setStale(false);
      setConnected(true);
      setError(false);
    } catch {
      const cached = await readSnapshot<FinanceData>().catch(() => null);
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
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    syncingRef.current = true;
    setSyncingQueue(true);

    try {
      const pending = (await readQueue<QueuedTransaction>())
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

        await removeQueuedTransaction(item.id);
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
  }, [refresh, reloadQueue]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    void reloadQueue().catch(console.error);
  }, [refresh, reloadQueue]);

  useEffect(() => {
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
  }, [refresh, syncQueue]);

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

  const queueTransaction = useCallback(async (transaction: QueuedTransaction) => {
    await enqueueTransaction(transaction);
    await reloadQueue();
  }, [reloadQueue]);

  const hasPending = useCallback(async () => {
    return (await readQueue<QueuedTransaction>()).length > 0;
  }, []);

  const hasPendingForAccount = useCallback(async (accountId: string) => {
    return (await readQueue<QueuedTransaction>())
      .some(item => item.accountId === accountId || item.toAccountId === accountId);
  }, []);

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
    return runExclusive(async () => {
      if (navigator.onLine) {
        const current = await financeApi.read();
        if (current.transactions.some(item => item.id === id)) {
          await removeQueuedTransaction(id);
          await reloadQueue();
          setData(current);
          void writeSnapshot(current).catch(console.error);
          setQueueError("");
          return "already-synced" as const;
        }
      }

      await removeQueuedTransaction(id);
      await reloadQueue();
      setQueueError("");
      return "discarded" as const;
    });
  }, [reloadQueue, runExclusive]);

  const clearOfflineCache = useCallback(async () => {
    return runExclusive(async () => {
      if (await hasPending()) {
        throw new Error("Selesaikan transaksi tertunda sebelum menghapus data offline.");
      }
      await clearDeviceCache();
    });
  }, [hasPending, runExclusive]);

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
