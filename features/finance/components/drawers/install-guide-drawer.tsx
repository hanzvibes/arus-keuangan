"use client";

import { Download, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { PwaState } from "@/lib/use-pwa";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pwa: PwaState;
  onCopyAppLink: () => void;
};

export function InstallGuideDrawer({ open, onOpenChange, pwa, onCopyAppLink }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="form-sheet install-guide-sheet">
        <DrawerHeader>
          <div className="drawer-heading">
            <DrawerTitle>Pasang Arus di HP</DrawerTitle>
            <button aria-label="Tutup panduan" onClick={() => onOpenChange(false)}>
              <X size={19} />
            </button>
          </div>
          <DrawerDescription>Buka dari layar utama seperti aplikasi biasa.</DrawerDescription>
        </DrawerHeader>
        <div className="form-sheet-scroll install-guide-body" data-vaul-no-drag>
          <p className="install-guide-callout">
            Jika Arus dibuka di dalam ChatGPT, salin tautannya lalu buka di Chrome (Android) atau Safari (iPhone).
          </p>
          <div className="install-guide-link">
            <span>{typeof window !== "undefined" ? window.location.origin + "/app" : "Tautan Arus"}</span>
            <button onClick={onCopyAppLink}>Salin tautan</button>
          </div>
          <h3>{pwa.ios ? "Di iPhone · Safari" : "Di Android · Chrome"}</h3>
          <ol>
            {pwa.ios ? (
              <>
                <li>Buka tautan Arus di Safari, lalu masuk dengan akun yang sama jika diminta.</li>
                <li>Ketuk tombol Bagikan, kemudian pilih <b>Tambahkan ke Layar Utama</b>.</li>
                <li>Ketuk <b>Tambah</b>. Ikon Arus akan muncul di layar utama.</li>
              </>
            ) : (
              <>
                <li>Buka tautan Arus di Chrome, lalu masuk dengan akun yang sama jika diminta.</li>
                <li>Ketuk menu <b>⋮</b> di Chrome, lalu pilih <b>Tambahkan ke layar utama</b> atau <b>Instal aplikasi</b>.</li>
                <li>Konfirmasi <b>Instal</b>. Ikon Arus akan muncul di layar utama.</li>
              </>
            )}
          </ol>
          {pwa.canInstall && (
            <button className="save-button" onClick={() => { onOpenChange(false); void pwa.install(); }}>
              Pasang sekarang <Download size={17} />
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
