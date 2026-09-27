"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserRound, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function friendlySignupError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("already registered") || value.includes("already been registered")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (value.includes("password")) return "Password belum memenuhi persyaratan keamanan.";
  if (value.includes("rate limit")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  return "Pendaftaran belum berhasil. Periksa data lalu coba lagi.";
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      setError("Nama harus berisi 2 sampai 80 karakter.");
      return;
    }
    if (password.length < 8) {
      setError("Gunakan password minimal 8 karakter.");
      return;
    }
    if (password !== confirmation) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: name },
        },
      });

      if (authError) {
        setError(friendlySignupError(authError.message));
        return;
      }

      if (data.session) {
        window.location.assign("/");
        return;
      }

      setRegisteredEmail(email.trim());
    } catch {
      setError("Pendaftaran belum bisa diproses. Coba lagi.");
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
          <span className="auth-kicker">MULAI DENGAN RAPI</span>
          <h1>Satu akun.<br />Satu arus milikmu.</h1>
          <p>Setiap catatan keuangan dipisahkan per pengguna dan dilindungi langsung oleh Row Level Security di Supabase.</p>
        </div>
        <div className="auth-security-note">
          <LockKeyhole size={18} />
          <span>Data setiap pengguna terisolasi di database</span>
        </div>
      </section>

      <section className="auth-form-panel auth-register-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark"><Wallet size={23} strokeWidth={2.4} /></span>
          <span>arus<span className="auth-brand-dot">.</span></span>
        </div>

        <div className="auth-card">
          {registeredEmail ? (
            <div className="auth-success-card">
              <span className="auth-success-icon"><Mail size={26} /></span>
              <div className="auth-heading">
                <span>TINGGAL SATU LANGKAH</span>
                <h2>Cek emailmu</h2>
                <p>
                  Kami mengirim tautan verifikasi ke <strong>{registeredEmail}</strong>.
                  Buka tautan itu untuk mengaktifkan akun dan masuk ke Arus.
                </p>
              </div>
              <div className="auth-success-note">
                <CheckCircle2 size={18} />
                <span>Setelah terverifikasi, profil Arus dibuat otomatis.</span>
              </div>
              <a className="auth-secondary-link" href="/login">Kembali ke halaman masuk</a>
            </div>
          ) : (
            <>
              <div className="auth-heading">
                <span>BUAT AKUN ARUS</span>
                <h2>Mulai catat uangmu</h2>
                <p>Buat akun pribadi. Data keuanganmu tidak bercampur dengan pengguna lain.</p>
              </div>

              <form className="auth-form" onSubmit={register}>
                <label>
                  <span>Nama</span>
                  <div className="auth-input-with-icon">
                    <UserRound size={18} />
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Nama lengkap"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                </label>

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
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Minimal 8 karakter"
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

                <label>
                  <span>Ulangi password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Ketik ulang password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}

                <button className="auth-submit" type="submit" disabled={submitting}>
                  <span>{submitting ? "Membuat akun..." : "Buat akun"}</span>
                  {!submitting && <ArrowRight size={19} />}
                </button>
              </form>

              <p className="auth-footnote auth-switch">
                Sudah punya akun? <a href="/login">Masuk ke Arus</a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}