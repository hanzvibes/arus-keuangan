import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, BarChart3, CalendarClock,
  Check, ChevronRight, FileJson, Landmark, LayoutGrid, LockKeyhole, PiggyBank, Plus,
  ReceiptText, ScanLine, ShieldCheck, Sparkles, Target, TrendingUp, Wallet, WifiOff,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Arus — Uangmu punya arus. Kamu pegang arahnya.",
  description: "Catat pemasukan dan pengeluaran, atur budget per kategori, scan struk, dan lihat laporan bulanan dalam satu ruang pribadi.",
};

const navLinks = [
  { href: "#fitur", label: "Fitur" },
  { href: "#scan-struk", label: "Scan struk" },
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#keamanan", label: "Keamanan" },
  { href: "#faq", label: "FAQ" },
];

const platformNotes = [
  { icon: LayoutGrid, title: "Web & bisa dipasang", copy: "Buka di browser atau pasang di layar utama." },
  { icon: LockKeyhole, title: "Data per pengguna", copy: "Setiap catatan terikat ke akun pemiliknya." },
  { icon: WifiOff, title: "Siap offline", copy: "Catatan terakhir tetap bisa dibaca saat jaringan putus." },
  { icon: FileJson, title: "Bisa diekspor", copy: "Unduh seluruh datamu dalam satu berkas JSON." },
];

const features = [
  {
    icon: Landmark,
    title: "Semua akun dalam satu pandangan",
    copy: "Catat saldo bank, e-wallet, dan uang tunai. Transfer antar akun tercatat tanpa mengacaukan pemasukan dan pengeluaran.",
    visual: "accounts",
  },
  {
    icon: LayoutGrid,
    title: "Budget yang benar-benar terpakai",
    copy: "Tetapkan batas per kategori, lalu lihat sisa dan pemakaiannya sepanjang bulan.",
    visual: "budget",
  },
  {
    icon: BarChart3,
    title: "Laporan bulanan yang jujur",
    copy: "Arus kas bersih, perbandingan bulan sebelumnya, dan kategori terbesar dalam satu halaman.",
    visual: "report",
  },
  {
    icon: Target,
    title: "Target tabungan yang terukur",
    copy: "Simpan nominal target, tenggat, dan progresnya. Lihat perkiraan setoran bulanan agar tetap realistis.",
    visual: "goal",
  },
  {
    icon: CalendarClock,
    title: "Catatan rutin tanpa lupa",
    copy: "Listrik, internet, sewa. Arus mengingatkan dan mencatat hanya saat kamu konfirmasi.",
    visual: "recurring",
  },
];

const securityPoints = [
  {
    icon: LockKeyhole,
    title: "Ruang data terpisah",
    copy: "Policy Row Level Security di Postgres mengikat setiap baris ke auth.uid(), jadi aturan kepemilikan tidak bergantung pada tampilan.",
  },
  {
    icon: ShieldCheck,
    title: "Sesi diperiksa di server",
    copy: "Permintaan ke API tanpa sesi valid ditolak, dan mutasi lintas situs tidak diproses.",
  },
  {
    icon: WifiOff,
    title: "Cache dibersihkan saat keluar",
    copy: "Snapshot offline di perangkat dihapus ketika kamu logout, termasuk pada perangkat bersama.",
  },
];

const steps = [
  {
    number: "01",
    title: "Buat akun pribadi",
    copy: "Cukup email dan nama. Dashboard langsung siap dipakai.",
  },
  {
    number: "02",
    title: "Tambahkan akun dan transaksi",
    copy: "Mulai dari akun utama, lalu catat pemasukan dan pengeluaran harian.",
  },
  {
    number: "03",
    title: "Pantau arah keuanganmu",
    copy: "Atur budget, cek laporan bulanan, dan lihat progres target tabungan.",
  },
];

const faqs = [
  {
    question: "Apakah data saya bisa dilihat pengguna lain?",
    answer: "Tidak. Aturan kepemilikan diterapkan langsung di database melalui Row Level Security, sehingga setiap baris hanya dapat diakses oleh pemiliknya. Checkout frontend bukan satu-satunya lapisan pemisah.",
  },
  {
    question: "Apakah Arus harus selalu terhubung internet?",
    answer: "Tidak selalu. Arus menyimpan snapshot terakhir di perangkat, jadi catatan terakhir tetap bisa dibaca saat offline. Transaksi baru akan masuk antrean dan dikirim saat koneksi kembali.",
  },
  {
    question: "Apakah foto struk diunggah ke server?",
    answer: "Pemindaian teks struk berjalan di perangkatmu. Foto hanya disimpan di bucket privat bila kamu memilih menyimpannya bersama transaksi, dan hasil scan tidak pernah mengubah saldo secara otomatis.",
  },
  {
    question: "Bisakah saya memindahkan data ke tempat lain?",
    answer: "Bisa. Menu Data & Cadangan mengekspor seluruh data keuanganmu dalam berkas JSON, dan berkas yang sama dapat dipulihkan kembali secara atomik.",
  },
  {
    question: "Apakah transfer antar akun dihitung sebagai pengeluaran?",
    answer: "Tidak. Transfer dan penyesuaian saldo dicatat terpisah, sehingga laporan pemasukan dan pengeluaran tetap mencerminkan uang yang benar-benar masuk dan keluar.",
  },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-ambient" aria-hidden="true" />

      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link className="landing-logo" href="/" aria-label="Arus, beranda">
            <span className="landing-logo-mark"><Wallet size={22} strokeWidth={2.4} /></span>
            <span>arus<span className="landing-logo-dot">.</span></span>
          </Link>
          <nav className="landing-nav-links" aria-label="Navigasi utama">
            {navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="landing-nav-actions">
            <Link className="landing-nav-login" href="/login">Masuk</Link>
            <Link className="landing-button landing-button-small" href="/register">
              Buat akun <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><Sparkles size={13} aria-hidden="true" /> KEUANGAN PRIBADI, LEBIH TERARAH</span>
            <h1 id="landing-title">Uangmu punya arus.<br /><em>Kamu pegang arahnya.</em></h1>
            <p>Catat pemasukan dan pengeluaran, atur budget per kategori, dan lihat laporan bulanan yang jelas. Semua akunmu dalam satu ruang pribadi.</p>
            <div className="landing-hero-actions">
              <Link className="landing-button" href="/register">
                Mulai sekarang <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a className="landing-text-link" href="#fitur">Jelajahi fitur <ChevronRight size={17} aria-hidden="true" /></a>
            </div>
            <ul className="landing-hero-notes">
              <li><Check size={15} aria-hidden="true" /> Siap dipakai dalam satu menit</li>
              <li><Check size={15} aria-hidden="true" /> Data terpisah tiap pengguna</li>
              <li><Check size={15} aria-hidden="true" /> Tetap terbaca saat offline</li>
            </ul>
          </div>

          <div className="landing-stage">
            <span className="landing-preview-caption">PRATINJAU DASHBOARD · DATA CONTOH</span>
            <div className="landing-window">
              <div className="landing-window-bar" aria-hidden="true">
                <span className="landing-window-dot" /><span className="landing-window-dot" /><span className="landing-window-dot" />
                <span className="landing-window-url">arus.app/app</span>
                <span className="landing-window-badge">PWA</span>
              </div>
              <div className="landing-window-body" aria-label="Pratinjau dashboard Arus menggunakan data contoh">
                <div className="landing-preview-top">
                  <span className="landing-preview-brand"><span><Wallet size={15} /></span> arus.</span>
                  <span className="landing-preview-period">Oktober 2026</span>
                  <span className="landing-preview-avatar">A</span>
                </div>

                <div className="landing-balance">
                  <div className="landing-balance-head">
                    <span>TOTAL SALDO</span>
                    <span className="landing-balance-chip"><TrendingUp size={11} aria-hidden="true" /> +12,4%</span>
                  </div>
                  <strong>Rp 24.850.000</strong>
                  <small>Dari 3 akun · BCA, Mandiri, dompet digital</small>
                  <svg className="landing-spark" viewBox="0 0 260 56" fill="none" aria-hidden="true" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="landing-spark-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9ee55f" stopOpacity=".38" />
                        <stop offset="100%" stopColor="#9ee55f" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 46C18 42 30 33 50 35S86 24 106 27 142 15 162 18 200 8 222 11 250 4 260 6V56H0Z" fill="url(#landing-spark-fill)" />
                    <path d="M0 46C18 42 30 33 50 35S86 24 106 27 142 15 162 18 200 8 222 11 250 4 260 6" stroke="#9ee55f" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div className="landing-balance-split">
                    <div><span>Pemasukan</span><b>Rp 9.200.000</b></div>
                    <div><span>Pengeluaran</span><b>Rp 6.130.000</b></div>
                  </div>
                </div>

                <div className="landing-preview-actions">
                  <span><i className="landing-action-income"><ArrowDownLeft size={14} /></i> Masuk</span>
                  <span><i className="landing-action-expense"><ArrowUpRight size={14} /></i> Keluar</span>
                  <span><i className="landing-action-transfer"><ArrowLeftRight size={14} /></i> Transfer</span>
                  <span><i className="landing-action-scan"><ScanLine size={14} /></i> Struk</span>
                </div>

                <div className="landing-preview-grid">
                  <div className="landing-preview-card">
                    <div className="landing-card-title"><b>Pengeluaran 7 hari</b><small>Rp 835.000</small></div>
                    <div className="landing-bars" aria-hidden="true">
                      {[36, 61, 43, 79, 50, 70, 94].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
                    </div>
                    <div className="landing-bar-labels" aria-hidden="true"><span>S</span><span>S</span><span>R</span><span>K</span><span>J</span><span>S</span><span>M</span></div>
                  </div>
                  <div className="landing-preview-card landing-preview-budget">
                    <div className="landing-card-title"><b>Budget Oktober</b><small>57% terpakai</small></div>
                    <div className="landing-budget-row"><span>🍽️ Makan</span><strong>72%</strong></div>
                    <i><span style={{ width: "72%" }} /></i>
                    <div className="landing-budget-row"><span>🚗 Transport</span><strong>48%</strong></div>
                    <i><span style={{ width: "48%" }} /></i>
                    <div className="landing-budget-row"><span>🎬 Hiburan</span><strong>31%</strong></div>
                    <i><span style={{ width: "31%" }} /></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="landing-float landing-float-goal" aria-hidden="true">
              <div className="landing-float-head"><Target size={14} /> Target tabungan</div>
              <strong>Rp 8.160.000</strong>
              <small>68% dari Rp 12.000.000</small>
              <i><span style={{ width: "68%" }} /></i>
            </div>

            <div className="landing-float landing-float-scan" aria-hidden="true">
              <span className="landing-float-icon"><ReceiptText size={16} /></span>
              <div><small>Struk terbaca</small><b>Rp 86.500</b></div>
              <Check size={15} className="landing-float-check" />
            </div>
          </div>
        </div>

        <div className="landing-container landing-platform-strip">
          {platformNotes.map(({ icon: Icon, title, copy }) => (
            <div className="landing-platform-item" key={title}>
              <span><Icon size={17} strokeWidth={1.9} aria-hidden="true" /></span>
              <div><b>{title}</b><small>{copy}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-features" id="fitur" aria-labelledby="features-title">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-kicker">FITUR INTI</span>
            <h2 id="features-title">Semua yang dibutuhkan untuk mengatur uang.</h2>
            <p>Bukan sekadar buku catatan. Arus menyatukan pencatatan harian, budget, laporan, dan target dalam satu alur kerja.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, copy, visual }, index) => (
              <article className={`landing-feature landing-feature-${visual}${index === 0 ? " landing-feature-wide" : ""}`} key={title}>
                <span className="landing-feature-icon"><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <div className="landing-feature-visual" aria-hidden="true">
                  {visual === "accounts" && (
                    <>
                      <div className="landing-mini-account"><span className="landing-mini-logo">B</span><div><b>BCA</b><small>Tabungan utama</small></div><strong>Rp 12.480.000</strong></div>
                      <div className="landing-mini-account"><span className="landing-mini-logo landing-mini-logo-alt">M</span><div><b>Mandiri</b><small>Rekening gaji</small></div><strong>Rp 7.370.000</strong></div>
                      <div className="landing-mini-account"><span className="landing-mini-logo landing-mini-logo-warm">D</span><div><b>Dompet digital</b><small>Uang harian</small></div><strong>Rp 5.000.000</strong></div>
                    </>
                  )}
                  {visual === "budget" && (
                    <>
                      <div className="landing-budget-row"><span>Makan & minum</span><strong>72%</strong></div>
                      <i><span style={{ width: "72%" }} /></i>
                      <div className="landing-budget-row"><span>Transport</span><strong>48%</strong></div>
                      <i><span style={{ width: "48%" }} /></i>
                      <small className="landing-visual-note">Sisa budget bulan ini Rp 1.840.000</small>
                    </>
                  )}
                  {visual === "report" && (
                    <div className="landing-mini-chart">
                      <div className="landing-mini-chart-bars">
                        {[42, 58, 50, 72, 64, 88].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}
                      </div>
                      <div className="landing-mini-chart-labels"><span>Mei</span><span>Jun</span><span>Jul</span><span>Agu</span><span>Sep</span><span>Okt</span></div>
                    </div>
                  )}
                  {visual === "goal" && (
                    <div className="landing-mini-goal">
                      <div className="landing-mini-ring"><span>68%</span></div>
                      <div><b>Liburan akhir tahun</b><small>Rp 8.160.000 dari Rp 12.000.000</small><em>± Rp 1.280.000 / bulan</em></div>
                    </div>
                  )}
                  {visual === "recurring" && (
                    <>
                      <div className="landing-mini-recurring"><CalendarClock size={14} /><div><b>Internet rumah</b><small>Setiap tanggal 5</small></div><strong>Rp 350.000</strong></div>
                      <div className="landing-mini-recurring"><CalendarClock size={14} /><div><b>Listrik</b><small>Setiap tanggal 12</small></div><strong>Rp 420.000</strong></div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-scan" id="scan-struk" aria-labelledby="scan-title">
        <div className="landing-container landing-split">
          <div className="landing-split-copy">
            <span className="landing-kicker">SCAN STRUK</span>
            <h2 id="scan-title">Foto struknya. Arus bantu bacanya.</h2>
            <p>Pemindaian teks berjalan langsung di perangkatmu, tanpa mengirim foto ke server. Kamu tetap yang memeriksa dan memutuskan sebelum transaksi disimpan.</p>
            <ul className="landing-check-list">
              <li><Check size={16} aria-hidden="true" /> OCR Bahasa Indonesia dan Inggris</li>
              <li><Check size={16} aria-hidden="true" /> Merchant, tanggal, nominal, dan item terisi otomatis</li>
              <li><Check size={16} aria-hidden="true" /> Hasil scan tidak langsung mengubah saldo</li>
              <li><Check size={16} aria-hidden="true" /> Foto hanya tersimpan bila kamu memilihnya</li>
            </ul>
            <Link className="landing-text-link" href="/register">Coba scan struk pertamamu <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>

          <div className="landing-scan-visual" aria-hidden="true">
            <div className="landing-receipt">
              <span className="landing-receipt-label">STRUK · 12 OKT 2026</span>
              <strong>Kopi Kenangan</strong>
              <div className="landing-receipt-line"><span>Kopi susu 2x</span><span>72.000</span></div>
              <div className="landing-receipt-line"><span>Croissant</span><span>18.000</span></div>
              <div className="landing-receipt-line"><span>Pajak</span><span>4.500</span></div>
              <div className="landing-receipt-total"><span>TOTAL</span><b>86.500</b></div>
              <span className="landing-scan-beam" />
            </div>
            <div className="landing-scan-form">
              <div className="landing-scan-form-head"><ScanLine size={15} /><b>Hasil scan</b><span>3 item</span></div>
              <div className="landing-scan-field"><small>Merchant</small><b>Kopi Kenangan</b></div>
              <div className="landing-scan-field"><small>Nominal</small><b>Rp 86.500</b></div>
              <div className="landing-scan-field"><small>Kategori</small><b>Makan &amp; minum</b></div>
              <div className="landing-scan-button">Periksa &amp; simpan <Check size={14} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-reports" aria-labelledby="reports-title">
        <div className="landing-container landing-split landing-split-reverse">
          <div className="landing-reports-visual" aria-hidden="true">
            <div className="landing-reports-card">
              <div className="landing-reports-head"><div><small>Laporan Oktober</small><b>Arus kas bersih</b></div><span>+Rp 3.070.000</span></div>
              <div className="landing-reports-chart">
                {[42, 58, 50, 72, 64, 88].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} className={index === 5 ? "is-active" : undefined} />
                ))}
              </div>
              <div className="landing-reports-labels"><span>Mei</span><span>Jun</span><span>Jul</span><span>Agu</span><span>Sep</span><span>Okt</span></div>
              <div className="landing-reports-rows">
                <div><span>Pemasukan</span><b>Rp 9.200.000</b></div>
                <div><span>Pengeluaran</span><b>Rp 6.130.000</b></div>
                <div className="landing-reports-delta"><span>Dibanding September</span><b><ArrowDownLeft size={13} /> 8,4% lebih hemat</b></div>
              </div>
            </div>
          </div>
          <div className="landing-split-copy">
            <span className="landing-kicker">LAPORAN</span>
            <h2 id="reports-title">Bukan cuma catatan. Kamu lihat polanya.</h2>
            <p>Setiap akhir bulan, Arus merangkum ke mana uangmu pergi dan bagaimana perubahannya, tanpa perlu menghitung manual.</p>
            <ul className="landing-check-list landing-check-list-dark">
              <li><ArrowDownLeft size={16} aria-hidden="true" /> Arus kas bersih, terpisah dari transfer</li>
              <li><ArrowDownLeft size={16} aria-hidden="true" /> Perbandingan dengan bulan sebelumnya</li>
              <li><ArrowDownLeft size={16} aria-hidden="true" /> Tren enam bulan dan kategori terbesar</li>
              <li><ArrowDownLeft size={16} aria-hidden="true" /> Rincian seluruh kategori pengeluaran</li>
            </ul>
            <Link className="landing-text-link landing-text-link-dark" href="/register">Lihat contoh laporan <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="landing-how" id="cara-kerja" aria-labelledby="how-title">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head-row">
            <div>
              <span className="landing-kicker">CARA KERJA</span>
              <h2 id="how-title">Catat hari ini. Lihat polanya nanti.</h2>
            </div>
            <p>Mulai dari satu akun dan satu transaksi. Seiring catatan bertambah, budget dan laporan mulai memberi gambaran yang berguna.</p>
          </div>
          <ol className="landing-steps">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
          <div className="landing-offline-note">
            <span className="landing-offline-icon"><WifiOff size={18} aria-hidden="true" /></span>
            <div>
              <b>Jaringan putus bukan alasan kehilangan catatan.</b>
              <p>Snapshot terakhir tetap bisa dibuka, dan transaksi baru menunggu di antrean perangkat sampai koneksi kembali.</p>
            </div>
            <Link href="/register">Coba sekarang <ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="landing-security" id="keamanan" aria-labelledby="security-title">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head-center">
            <span className="landing-kicker">KEAMANAN &amp; PRIVASI</span>
            <h2 id="security-title">Ruang pribadi, bukan ruang publik.</h2>
            <p>Keuangan adalah data paling pribadi. Arus memisahkan data di level database, bukan hanya di tampilan.</p>
          </div>
          <div className="landing-security-grid">
            {securityPoints.map(({ icon: Icon, title, copy }) => (
              <article className="landing-security-card" key={title}>
                <span className="landing-security-icon"><Icon size={20} strokeWidth={1.9} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <p className="landing-security-foot">
            <ShieldCheck size={16} aria-hidden="true" />
            Autentikasi Supabase, database Postgres dengan Row Level Security, dan bucket foto privat.
          </p>
        </div>
      </section>

      <section className="landing-faq" id="faq" aria-labelledby="faq-title">
        <div className="landing-container landing-faq-inner">
          <div className="landing-faq-intro">
            <span className="landing-kicker">PERTANYAAN UMUM</span>
            <h2 id="faq-title">Yang sering ditanyakan.</h2>
            <p>Belum menemukan jawabannya? Buat akun dan jelajahi sendiri, semua fitur utama bisa langsung dicoba.</p>
            <Link className="landing-button landing-button-small" href="/register">Buat akun <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <div className="landing-faq-list">
            {faqs.map(({ question, answer }) => (
              <details className="landing-faq-item" key={question}>
                <summary>
                  <span>{question}</span>
                  <Plus size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <div className="landing-container">
          <div className="landing-final-card">
            <div className="landing-final-orb" aria-hidden="true" />
            <span className="landing-kicker landing-kicker-light">MULAI DARI SINI</span>
            <h2 id="final-title">Beri uangmu arah yang lebih jelas.</h2>
            <p>Catatan kecil hari ini bisa jadi gambaran besar bulan depan.</p>
            <div className="landing-final-actions">
              <Link className="landing-button landing-button-invert" href="/register">
                Buat akun Arus <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="landing-button-ghost" href="/login">Sudah punya akun? Masuk</Link>
            </div>
            <ul className="landing-final-notes">
              <li><Check size={14} aria-hidden="true" /> Cukup email untuk mulai</li>
              <li><Check size={14} aria-hidden="true" /> Data kapan saja bisa diekspor</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-footer-logo">arus<span className="landing-logo-dot">.</span></span>
            <p>Keuangan pribadi, lebih terarah. Dibangun untuk mencatat dengan tenang dan melihat dengan jernih.</p>
          </div>
          <nav className="landing-footer-links" aria-label="Tautan footer">
            <div>
              <b>Produk</b>
              <a href="#fitur">Fitur</a>
              <a href="#scan-struk">Scan struk</a>
              <a href="#cara-kerja">Cara kerja</a>
            </div>
            <div>
              <b>Keamanan</b>
              <a href="#keamanan">Privasi data</a>
              <a href="#faq">Pertanyaan umum</a>
            </div>
            <div>
              <b>Akun</b>
              <Link href="/login">Masuk</Link>
              <Link href="/register">Buat akun</Link>
              <Link href="/forgot-password">Lupa password</Link>
            </div>
          </nav>
        </div>
        <div className="landing-container landing-footer-bottom">
          <span>© {new Date().getFullYear()} Arus. Keuangan pribadi, lebih terarah.</span>
          <div className="landing-footer-badges">
            <span><PiggyBank size={14} aria-hidden="true" /> Budgeting</span>
            <span><ShieldCheck size={14} aria-hidden="true" /> Data privat</span>
            <span><WifiOff size={14} aria-hidden="true" /> Offline</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
