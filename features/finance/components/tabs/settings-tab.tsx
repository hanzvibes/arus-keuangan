import type { RefObject } from "react";
import { Check, Download, Upload, Wallet, WifiOff } from "lucide-react";
import type { Account, Category, QueuedTransaction } from "@/domain/finance/types";
import type { PwaState } from "@/lib/use-pwa";
import { AuthUser } from "@/features/auth/components/auth-user";
import { CategoryManager } from "@/features/finance/components/category-manager";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { TransactionList } from "@/features/finance/components/transaction-list";

type Props = {
  pwa: PwaState;
  categories: Category[];
  accounts: Account[];
  queued: QueuedTransaction[];
  offline: boolean;
  queueError: string;
  syncingQueue: boolean;
  formatMoney: (value: number) => string;
  fileRef: RefObject<HTMLInputElement | null>;
  onRefresh: () => Promise<void>;
  hasPending: () => Promise<boolean>;
  onOpenInstallGuide: () => void;
  onExportBackup: () => void;
  onExportCsv: () => void;
  onSelectBackup: (file?: File) => void;
  onSyncQueue: () => void;
  onDiscardQueued: (id: string) => void;
  onRemoveDeviceCache: () => void;
};

export function SettingsTab({
  pwa,
  categories,
  accounts,
  queued,
  offline,
  queueError,
  syncingQueue,
  formatMoney,
  fileRef,
  onRefresh,
  hasPending,
  onOpenInstallGuide,
  onExportBackup,
  onExportCsv,
  onSelectBackup,
  onSyncQueue,
  onDiscardQueued,
  onRemoveDeviceCache,
}: Props) {
  const pending = queued.slice().sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

  return (
    <section className="screen">
      <ScreenTitle title="Data & Cadangan" subtitle="Atur kategori dan simpan salinan catatanmu." />
      <AuthUser variant="settings" />

      <div className="surface data-panel pwa-panel">
        <div className="data-panel-head">
          <span className="pwa-panel-icon"><Wallet size={23} /></span>
          <div>
            <h2>Pasang Arus</h2>
            <p>Buka langsung dari layar utama seperti aplikasi di HP.</p>
          </div>
        </div>
        {pwa.installed ? (
          <p className="pwa-status"><Check size={16} /> Sudah terpasang di perangkat ini.</p>
        ) : (
          <div className="pwa-actions">
            {pwa.canInstall && (
              <button className="restore-select" onClick={() => void pwa.install()}>
                <Download size={17} /> Pasang di perangkat
              </button>
            )}
            <button className="restore-select" onClick={onOpenInstallGuide}>Cara pasang di HP</button>
          </div>
        )}
        {pwa.ready && (
          <p className="pwa-footnote">
            Catatan terakhir tersedia saat offline. Transaksi baru akan dikirim setelah tersambung.
          </p>
        )}
      </div>

      <CategoryManager
        custom={categories}
        offline={offline}
        pendingCount={queued.length}
        hasPending={hasPending}
        onChange={onRefresh}
      />

      <div className="surface data-panel">
        <div className="data-panel-head">
          <Download size={22} />
          <div>
            <h2>Unduh data</h2>
            <p>Cadangan JSON bisa dipulihkan; CSV untuk membuka transaksi di spreadsheet.</p>
          </div>
        </div>
        <div className="data-actions">
          <button disabled={queued.length > 0} onClick={onExportBackup}>
            <Download size={17} /> Unduh cadangan
          </button>
          <button disabled={queued.length > 0} onClick={onExportCsv}>
            <Download size={17} /> Ekspor CSV
          </button>
        </div>
        {queued.length > 0 && (
          <p className="inline-note">Selesaikan transaksi tertunda agar unduhan memuat semua catatan.</p>
        )}
      </div>

      <div className="surface data-panel">
        <div className="data-panel-head">
          <Upload size={22} />
          <div>
            <h2>Pulihkan cadangan</h2>
            <p>Isi saat ini akan diganti seluruhnya. Unduh cadangan terbaru sebelum memulihkan.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept=".json,application/json"
          onChange={event => onSelectBackup(event.target.files?.[0])}
        />
        <button className="restore-select" onClick={() => fileRef.current?.click()}>
          <Upload size={17} /> Pilih file JSON
        </button>
      </div>

      <div className="surface data-panel">
        <div className="data-panel-head">
          <WifiOff size={22} />
          <div>
            <h2>Data offline</h2>
            <p>Arus menyimpan salinan terakhir di perangkat ini. Transaksi baru saat offline akan dikirim saat koneksi kembali.</p>
          </div>
        </div>
        <p className="offline-count">{queued.length} transaksi menunggu sinkronisasi</p>
        {queued.length > 0 && (
          <div className="pending-list">
            <div className="pending-list-head">
              <h3>Transaksi tertunda</h3>
              <button disabled={offline || syncingQueue} onClick={onSyncQueue}>
                {syncingQueue ? "Mengirim..." : "Kirim sekarang"}
              </button>
            </div>
            {queueError && <p className="inline-note">{queueError}</p>}
            <TransactionList
              items={pending}
              accounts={accounts}
              queued={queued}
              formatMoney={formatMoney}
              deletable
              syncingQueue={syncingQueue}
              onDiscardQueued={onDiscardQueued}
            />
          </div>
        )}
        <button
          className="restore-select"
          disabled={queued.length > 0 || syncingQueue}
          onClick={onRemoveDeviceCache}
        >
          Hapus salinan perangkat
        </button>
        {queued.length > 0 && (
          <p className="inline-note">Kirim atau batalkan transaksi tertunda sebelum menghapus salinan.</p>
        )}
      </div>

      <p className="data-footnote">Catatan asli tersimpan di aplikasi privat ini.</p>
    </section>
  );
}