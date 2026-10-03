"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, Mail, Save, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function joinedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw authError || new Error("User tidak tersedia.");

        const profile = await supabase
          .from("profiles")
          .select("full_name,created_at")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile.error) throw profile.error;
        if (!active) return;

        const metadata = authData.user.user_metadata as Record<string, unknown>;
        const metadataName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
        const name = profile.data?.full_name?.trim() || metadataName || authData.user.email?.split("@")[0] || "Pengguna";

        setFullName(name);
        setInitialName(name);
        setEmail(authData.user.email || "");
        setCreatedAt(profile.data?.created_at || authData.user.created_at || "");
      } catch (loadError) {
        console.error("Profile load failed", loadError);
        if (active) setError("Profil belum bisa dimuat. Coba buka ulang halaman.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const initial = useMemo(
    () => fullName.trim().charAt(0).toUpperCase() || "A",
    [fullName],
  );

  const dirty = fullName.trim().replace(/\s+/g, " ") !== initialName;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim().replace(/\s+/g, " ");
    setError("");
    setMessage("");

    if (name.length < 2 || name.length > 80) {
      setError("Nama harus berisi 2 sampai 80 karakter.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("User tidak tersedia.");

      const profileResult = await supabase
        .from("profiles")
        .update({ full_name: name, updated_at: new Date().toISOString() })
        .eq("id", authData.user.id)
        .select("id")
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;
      if (!profileResult.data) throw new Error("Profil tidak ditemukan.");

      const metadataResult = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (metadataResult.error) throw metadataResult.error;

      setFullName(name);
      setInitialName(name);
      setMessage("Profil berhasil diperbarui.");
    } catch (saveError) {
      console.error("Profile update failed", saveError);
      setError("Perubahan profil belum bisa disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <Link className="profile-back" href="/app" aria-label="Kembali ke Arus">
          <ArrowLeft size={19} />
        </Link>
        <div className="profile-brand">
          <span><Wallet size={20} /></span>
          arus<span className="auth-brand-dot">.</span>
        </div>
        <span className="profile-topbar-spacer" />
      </header>

      <section className="profile-shell">
        <div className="profile-heading">
          <span className="profile-kicker">PROFIL PRIBADI</span>
          <h1>Profil Arus</h1>
          <p>Identitas ini hanya digunakan untuk pengalaman akunmu di Arus.</p>
        </div>

        <div className="profile-grid">
          <aside className="profile-summary-card">
            <span className="profile-avatar">{initial}</span>
            <div>
              <h2>{loading ? "Memuat profil..." : fullName || "Pengguna"}</h2>
              <p>{email || "Akun Arus"}</p>
            </div>
            <div className="profile-security-badge">
              <ShieldCheck size={17} />
              <span>Profil pribadi</span>
            </div>
          </aside>

          <div className="profile-form-card">
            <div className="profile-card-head">
              <span><UserRound size={21} /></span>
              <div>
                <h2>Informasi akun</h2>
                <p>Nama dapat diubah kapan saja. Email mengikuti akun Supabase Auth.</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={saveProfile}>
              <label>
                <span>Nama</span>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  disabled={loading || saving}
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setMessage("");
                  }}
                />
              </label>

              <label>
                <span>Email</span>
                <div className="profile-readonly-field">
                  <Mail size={17} />
                  <span>{email || "Memuat email..."}</span>
                </div>
              </label>

              <label>
                <span>Bergabung</span>
                <div className="profile-readonly-field">
                  <CalendarDays size={17} />
                  <span>{createdAt ? joinedLabel(createdAt) : "Memuat tanggal..."}</span>
                </div>
              </label>

              {error && <div className="auth-error" role="alert">{error}</div>}
              {message && (
                <div className="profile-success" role="status">
                  <Check size={17} />
                  <span>{message}</span>
                </div>
              )}

              <button className="profile-save" type="submit" disabled={loading || saving || !dirty}>
                <Save size={17} />
                {saving ? "Menyimpan..." : dirty ? "Simpan perubahan" : "Sudah tersimpan"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
