"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Mail, ShieldCheck, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function friendlyResetError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("rate limit") || value.includes("too many")) {
    return "Terlalu banyak permintaan. Coba lagi beberapa saat.";
  }
  return "Email pemulihan belum bisa dikirim. Coba lagi.";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );

      if (resetError) {
        setError(friendlyResetError(resetError.message));
        return;
      }

      setSent(true);
    } catch {
      setError("Email pemulihan belum bisa dikirim. Coba lagi.");
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
          <span className="auth-kicker">PEMULIHAN AKUN</span>
          <h1>Lupa password?<br />Arahkan ulang aksesmu.</h1>
          <p>Kami kirim tautan pemulihan ke email akunmu. Tautan itu akan membawamu kembali ke Arus untuk membuat password baru.</p>
        </div>
        <div className="auth-security-note">
          <ShieldCheck size={18} />
          <span>Pemulihan diproses melalui Supabase Auth</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark"><Wallet size={23} strokeWidth={2.4} /></span>
          <span>arus<span className="auth-brand-dot">.</span></span>
        </div>

        <div className="auth-card">
          {sent ? (
            <div className="auth-success-card">
              <span className="auth-success-icon"><Mail size={24} /></span>
              <div className="auth-heading">
                <span>CEK EMAILMU</span>
                <h2>Tautan pemulihan dikirim</h2>
                <p>
                  Jika <strong>{email.trim()}</strong> terdaftar di Arus, email pemulihan akan masuk beberapa saat lagi.
                </p>
              </div>
              <p className="auth-success-note">
                Periksa folder spam jika email belum terlihat. Demi privasi, Arus tidak mengungkap apakah alamat email terdaftar.
              </p>
              <a className="auth-secondary-link" href="/login">
                <ArrowLeft size={17} /> Kembali ke login
              </a>
            </div>
          ) : (
            <>
              <div className="auth-heading">
                <span>LUPA PASSWORD</span>
                <h2>Pulihkan akses</h2>
                <p>Masukkan email akun Arus. Kami akan mengirim tautan untuk membuat password baru.</p>
              </div>

              <form className="auth-form" onSubmit={requestReset}>
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
                    onChange={event => setEmail(event.target.value)}
                  />
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}

                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? "Mengirim..." : "Kirim tautan pemulihan"}
                </button>
              </form>

              <p className="auth-footnote auth-switch">
                Ingat passwordmu? <a href="/login">Kembali masuk</a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
