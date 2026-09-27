"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthUserProps = {
  variant: "sidebar" | "greeting";
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
      void supabase.auth.getUser().then(({ data }) => {
        if (!active || !data.user) return;
        const email = data.user.email || "";
        const metadata = data.user.user_metadata as Record<string, unknown>;
        const metadataName =
          typeof metadata.full_name === "string" ? metadata.full_name.trim() :
          typeof metadata.name === "string" ? metadata.name.trim() :
          "";
        const emailName = email.split("@")[0]?.trim() || "";
        setViewer({
          name: metadataName || emailName || fallback.name,
          email: email || fallback.email,
        });
      });
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
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
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
