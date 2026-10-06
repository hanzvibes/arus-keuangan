import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check,
  ChevronRight, LayoutGrid, LockKeyhole, Plus, Wallet, WifiOff,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Arus — Uangmu punya arus. Kamu pegang arahnya.",
  description: "Catat pemasukan dan pengeluaran, pantau saldo serta budget, dan lihat arah keuanganmu bersama Arus.",
};

const benefits = [
  { icon: Wallet, title: "Semua akun, satu pandangan", copy: "Lihat saldo dari akun yang kamu catat tanpa berpindah-pindah tempat." },
  { icon: LayoutGrid, title: "Budget yang mudah dipantau", copy: "Atur batas pengeluaran per kategori dan lihat pemakaiannya sepanjang bulan." },
  { icon: BarChart3, title: "Tahu arah uangmu", copy: "Bandingkan pemasukan, pengeluaran, dan kategori yang paling banyak dipakai." },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-glow" aria-hidden="true" />
      <header className="landing-header landing-container">
        <Link className="landing-logo" href="/" aria-label="Arus, beranda">
          <span className="landing-logo-mark"><Wallet size={23} strokeWidth={2.4} /></span>
          <span>arus<span className="landing-logo-dot">.</span></span>
        </Link>
        <nav className="landing-nav" aria-label="Navigasi utama">
          <Link className="landing-nav-login" href="/login">Masuk</Link>
          <Link className="landing-button landing-button-small" href="/register">Buat akun <ArrowRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      <section className="landing-hero landing-container" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><span /> KEUANGAN PRIBADI, LEBIH TERARAH</span>
          <h1 id="landing-title">Uangmu punya arus.<br /><em>Kamu pegang arahnya.</em></h1>
          <p>Catat yang masuk dan keluar, pantau budget, lalu lihat gambaran keuanganmu dengan lebih jernih. Semua dalam satu ruang pribadi.</p>
          <div className="landing-hero-actions">
            <Link className="landing-button" href="/register">Buat akun Arus <ArrowRight size={19} aria-hidden="true" /></Link>
            <a className="landing-text-link" href="#lihat-arus">Lihat tampilannya <ChevronRight size={18} aria-hidden="true" /></a>
          </div>
          <div className="landing-hero-notes">
            <span><Check size={16} aria-hidden="true" /> Mulai dari catatan pertamamu</span>
            <span><LockKeyhole size={16} aria-hidden="true" /> Data tiap pengguna terpisah</span>
          </div>
        </div>

        <div className="landing-preview-wrap" id="lihat-arus">
          <div className="landing-preview-caption">PRATINJAU ARUS · DATA CONTOH</div>
          <div className="landing-preview" aria-label="Pratinjau dashboard Arus menggunakan data contoh">
            <div className="landing-preview-top">
              <span className="landing-preview-brand"><span><Wallet size={17} /></span> arus.</span>
              <span className="landing-preview-avatar">A</span>
            </div>
            <div className="landing-preview-greeting">Selamat pagi, Andi <span>👋</span></div>
            <div className="landing-preview-balance">
              <span>TOTAL SALDO</span><strong>Rp 8.450.000</strong><small>Dari 2 akun</small>
              <Wallet className="landing-preview-watermark" size={95} strokeWidth={1.1} aria-hidden="true" />
            </div>
            <div className="landing-preview-actions">
              <span><i className="landing-preview-action-income"><ArrowDownLeft size={16} /></i> Pemasukan</span>
              <span><i className="landing-preview-action-expense"><ArrowUpRight size={16} /></i> Pengeluaran</span>
              <span className="landing-preview-action-plus"><Plus size={18} /></span>
            </div>
            <div className="landing-preview-grid">
              <div className="landing-preview-card">
                <div className="landing-preview-card-title"><b>Pengeluaran 7 hari</b><small>Rp 835.000</small></div>
                <div className="landing-bars" aria-hidden="true">
                  {[36, 61, 43, 79, 50, 70, 94].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
                </div>
                <div className="landing-bar-labels" aria-hidden="true"><span>S</span><span>S</span><span>R</span><span>K</span><span>J</span><span>S</span><span>M</span></div>
              </div>
              <div className="landing-preview-card landing-preview-budget">
                <b>Budget bulan ini</b>
                <div><span>🍽️ Makan</span><strong>65%</strong></div><i><span style={{ width: "65%" }} /></i>
                <div><span>🚗 Transport</span><strong>42%</strong></div><i><span style={{ width: "42%" }} /></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-benefits landing-container" aria-labelledby="benefits-title">
        <div className="landing-section-heading">
          <span className="landing-kicker">SATU TEMPAT UNTUK HAL PENTING</span>
          <h2 id="benefits-title">Lebih paham ke mana uangmu pergi.</h2>
          <p>Arus membantumu melihat catatan harian dan gambaran besarnya tanpa membuat keuangan terasa rumit.</p>
        </div>
        <div className="landing-benefit-grid">
          {benefits.map(({ icon: Icon, title, copy }) => (
            <article className="landing-benefit-card" key={title}>
              <span className="landing-benefit-icon"><Icon size={23} strokeWidth={1.9} aria-hidden="true" /></span>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-how" aria-labelledby="how-title">
        <div className="landing-container landing-how-inner">
          <div>
            <span className="landing-kicker">MULAI DENGAN SEDERHANA</span>
            <h2 id="how-title">Catat hari ini.<br />Lihat polanya nanti.</h2>
            <p>Mulai dari akun dan transaksi pertamamu. Seiring catatan bertambah, budget dan analitik membantumu mengambil keputusan.</p>
            <div className="landing-offline-note"><WifiOff size={18} aria-hidden="true" /><span>Saat koneksi terputus, catatan terakhir bisa dilihat dan transaksi baru menunggu untuk dikirim.</span></div>
          </div>
          <ol className="landing-steps">
            <li><span>01</span><div><h3>Buat akun pribadi</h3><p>Siapkan ruang untuk catatan keuanganmu.</p></div></li>
            <li><span>02</span><div><h3>Catat pemasukan dan pengeluaran</h3><p>Tambahkan akun, transaksi, dan kategori sesuai kebutuhan.</p></div></li>
            <li><span>03</span><div><h3>Pantau arah keuanganmu</h3><p>Lihat saldo, budget, dan ringkasan bulanan dalam satu tempat.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="landing-final landing-container" aria-labelledby="final-title">
        <span className="landing-kicker">MULAI DARI SINI</span>
        <h2 id="final-title">Beri uangmu arah yang lebih jelas.</h2>
        <p>Satu catatan kecil hari ini bisa membantumu melihat gambaran yang lebih besar.</p>
        <Link className="landing-button" href="/register">Buat akun Arus <ArrowRight size={19} aria-hidden="true" /></Link>
      </section>
      <footer className="landing-footer landing-container">
        <span>arus<span className="landing-logo-dot">.</span></span>
        <span>Keuangan pribadi, lebih terarah.</span>
        <Link href="/login">Masuk ke Arus</Link>
      </footer>
    </main>
  );
}
