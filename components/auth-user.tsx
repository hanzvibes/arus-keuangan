"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, Pencil, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearDeviceCache, readQueue } from "@/lib/offline";

type AuthUserProps = {
  variant: "sidebar" | "greeting" | "settings";
};

type Viewer = {
  name: string;
  email: string;
};

const fallback: Viewer = {
  name: "Pengguna",
  email: "Keuangan pribadi",
};

export function AuthUser({ variant }: AuthUserProps) {
  const [viewer, setViewer] = useState<Viewer>(fallback);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    try {
      const supabase = createClient();

      void (async () => {
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;

        const email = data.user.email || "";
        const metadata = data.user.user_metadata as Record<string, unknown>;
        const metadataName =
          typeof metadata.full_name === "string" ? metadata.full_name.trim() :
          typeof metadata.name === "string" ? metadata.name.trim() :
          "";

        const profile = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!active) return;

        const profileName = profile.data?.full_name?.trim() || "";
        const emailName = email.split("@")[0]?.trim() || "";

        setViewer({
          name: profileName || metadataName || emailName || fallback.name,
          email: email || fallback.email,
        });
      })();
    } catch {
      // The auth gate handles missing configuration. Keep a neutral fallback here.
    }

    return () => {
      active = false;
    };
  }, []);

  const initial = useMemo(
    () => viewer.name.trim().charAt(0).toUpperCase() || "A",
    [viewer.name],
  );

  async function signOut() {
    setSigningOut(true);
    try {
      const pending = await readQueue<unknown>();
      if (pending.length > 0) {
        const discard = window.confirm(
          `Ada ${pending.length} transaksi offline yang belum terkirim. Keluar sekarang akan menghapus antrean lokal itu. Tetap keluar?`,
        );
        if (!discard) {
          setSigningOut(false);
          return;
        }
      }

      await clearDeviceCache();

      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      window.location.assign("/login");
    } catch (error) {
      console.error("Sign out failed", error);
      window.alert("Belum bisa keluar. Pastikan tab Arus lain ditutup lalu coba lagi.");
      setSigningOut(false);
    }
  }

  if (variant === "greeting") {
    return (
      <div className="greeting">
        <span className="avatar">{initial}</span>
        <div>
          <span>Selamat datang,</span>
          <strong>{viewer.name} 👋</strong>
        </div>
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div className="surface data-panel auth-account-panel">
        <div className="data-panel-head">
          <span className="auth-account-icon"><UserRound size={22} /></span>
          <div>
            <h2>Akun Arus</h2>
            <p>{viewer.name} · {viewer.email}</p>
          </div>
        </div>
        <div className="auth-account-actions">
          <a className="restore-select auth-profile-link" href="/profile">
            <Pencil size={16} />
            Kelola profil
          </a>
          <button
            className="restore-select auth-settings-logout"
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut size={17} />
            {signingOut ? "Keluar..." : "Keluar dari akun"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nav-footer">
      <span className="avatar">{initial}</span>
      <div className="nav-user-copy">
        <b>{viewer.name}</b>
        <small>{viewer.email}</small>
      </div>
      <button
        className="nav-logout"
        type="button"
        aria-label="Keluar dari Arus"
        title="Keluar"
        disabled={signingOut}
        onClick={() => void signOut()}
      >
        <LogOut size={17} />
      </button>
    </div>
  );
}
