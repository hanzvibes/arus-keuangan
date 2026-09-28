"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function friendlyPasswordError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("weak") || value.includes("password")) {
    return "Password belum memenuhi aturan keamanan. Gunakan password yang lebih kuat.";
  }
  if (value.includes("session") || value.includes("auth")) {
    return "Sesi pemulihan sudah tidak valid. Minta tautan baru dari halaman lupa password.";
  }
  return "Password belum bisa diperbarui. Coba lagi.";
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Gunakan minimal 8 karakter.");
      return;
    }
    if (password !== confirmation) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(friendlyPasswordError(updateError.message));
        return;
      }

      setPassword("");
      setConfirmation("");
      setUpdated(true);
    } catch {
      setError("Password belum bisa diperbarui. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-hidden="true">
        <div className="auth-brand">
          <span className="auth-brand-mark"><Wallet size={27} strokeWidth={2.4} /></span>
          <span>arus<span className="auth-brand-dot">.</span></span>
        </div>
        <div className="auth-brand-copy">
          <span className="auth-kicker">PASSWORD BARU</span>
          <h1>Kunci baru.<br />Catatan tetap milikmu.</h1>
          <p>Buat password baru untuk akun Arusmu. Data keuangan tetap terlindungi oleh session dan aturan akses per-user.</p>
        </div>
        <div className="auth-security-note">
          <LockKeyhole size={18} />
          <span>Perubahan password membutuhkan session terautentikasi</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark"><Wallet size={23} strokeWidth={2.4} /></span>
          <span>arus<span className="auth-brand-dot">.</span></span>
        </div>

        <div className="auth-card">
          {updated ? (
            <div className="auth-success-card">
              <span className="auth-success-icon"><CheckCircle2 size={25} /></span>
              <div className="auth-heading">
                <span>BERHASIL DIPERBARUI</span>
                <h2>Password baru aktif</h2>
                <p>Akses akunmu sudah menggunakan password yang baru.</p>
              </div>
              <a className="auth-secondary-link" href="/">
                Lanjut ke Arus <ArrowRight size={17} />
              </a>
            </div>
          ) : (
            <>
              <div className="auth-heading">
                <span>BUAT PASSWORD BARU</span>
                <h2>Atur ulang password</h2>
                <p>Gunakan minimal 8 karakter dan hindari password yang pernah kamu pakai di layanan lain.</p>
              </div>

              <form className="auth-form" onSubmit={updatePassword}>
                <label>
                  <span>Password baru</span>
                  <div className="auth-password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Minimal 8 karakter"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      onClick={() => setShowPassword(value => !value)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label>
                  <span>Ulangi password baru</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Ketik ulang password"
                    value={confirmation}
                    onChange={event => setConfirmation(event.target.value)}
                  />
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}

                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? "Memperbarui..." : "Simpan password baru"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
