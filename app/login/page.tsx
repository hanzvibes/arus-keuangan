"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email atau password salah.";
  if (value.includes("email not confirmed")) return "Email belum dikonfirmasi.";
  if (value.includes("rate limit")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  return "Login belum berhasil. Periksa email dan passwordmu.";
}

export default function LoginPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "config") {
      setError("Konfigurasi Supabase belum tersedia di environment aplikasi.");
    }
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!configured) {
      setError("Konfigurasi Supabase belum tersedia di environment aplikasi.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(friendlyAuthError(authError.message));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const requested = params.get("next");
      const destination =
        requested && requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/";
      window.location.assign(destination);
    } catch {
      setError("Login belum bisa diproses. Coba lagi.");
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
          <span className="auth-kicker">KEUANGAN PRIBADI</span>
          <h1>Uangmu punya arus.<br />Kamu pegang arahnya.</h1>
          <p>Catat transaksi, pantau budget, dan lihat kondisi keuanganmu dalam satu ruang yang privat.</p>
        </div>
        <div className="auth-security-note">
          <LockKeyhole size={18} />
          <span>Sesi diamankan dengan Supabase Auth</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark"><Wallet size={23} strokeWidth={2.4} /></span>
          <span>arus<span className="auth-brand-dot">.</span></span>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <span>SELAMAT DATANG KEMBALI</span>
            <h2>Masuk ke Arus</h2>
            <p>Gunakan akun yang terdaftar untuk membuka catatan keuanganmu.</p>
          </div>

          <form className="auth-form" onSubmit={login}>
            <label>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              <span>Password</span>
              <div className="auth-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className="auth-error" role="alert">{error}</div>}

            <button className="auth-submit" type="submit" disabled={submitting || !configured}>
              <span>{submitting ? "Memverifikasi..." : "Masuk"}</span>
              {!submitting && <ArrowRight size={19} />}
            </button>
          </form>

          <p className="auth-footnote">
            Akses hanya untuk akun yang sudah terdaftar di Supabase Auth.
          </p>
        </div>
      </section>
    </main>
  );
}
