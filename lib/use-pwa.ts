"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function usePwa() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const [ios] = useState(() => typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)));
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(isStandalone());
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    displayMode.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;
    const onUpdateFound = () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", () => {
        if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
      });
    };
    const onControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
      else { setWaiting(null); navigator.serviceWorker.controller?.postMessage({ type: "CACHE_SHELL" }); }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      document.addEventListener("visibilitychange", onVisible);
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(async result => {
        if (disposed) return;
        registration = result;
        result.addEventListener("updatefound", onUpdateFound);
        if (result.waiting && navigator.serviceWorker.controller) setWaiting(result.waiting);
        await navigator.serviceWorker.ready;
        if (!disposed) {
          setReady(true);
          result.active?.postMessage({ type: "CACHE_SHELL" });
        }
      }).catch(() => {});
    }

    return () => {
      disposed = true;
      displayMode.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch { /* The browser's install menu remains available. */ }
    finally { setInstallPrompt(null); }
  }

  function applyUpdate() {
    if (!waiting) return;
    reloadAfterUpdate.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return { canInstall: !!installPrompt && !installed, installed, ios, ready, updateAvailable: !!waiting, install, applyUpdate };
}
