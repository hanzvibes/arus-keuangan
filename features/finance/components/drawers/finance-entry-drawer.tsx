"use client";

import type { FormEvent } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, Budget, Transaction, TransactionType } from "@/domain/finance/types";

export type FinanceEntryMode = "account" | "transaction" | "budget" | "quick" | null;
export type FinanceEntryType = Exclude<TransactionType, "adjustment">;

type Props = {
  mode: FinanceEntryMode;
  editing: string | null;
  saving: boolean;
  quickText: string;
  name: string;
  kind: string;
  opening: string;
  amount: string;
  account: string;
  destination: string;
  category: string;
  note: string;
  date: string;
  type: FinanceEntryType;
  accounts: Account[];
  transactions: Transaction[];
  categories: string[];
  activeBudget?: Budget;
  beforeBudget: number;
  afterBudget: number;
  formatMoney: (value: number) => string;
  onModeChange: (mode: FinanceEntryMode) => void;
  onQuickTextChange: (value: string) => void;
  onReadQuick: () => void;
  onNameChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onOpeningChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTypeChange: (type: FinanceEntryType) => void;
  onSubmit: (event: FormEvent) => void;
};

export function FinanceEntryDrawer({
  mode,
  editing,
  saving,
  quickText,
  name,
  kind,
  opening,
  amount,
  account,
  destination,
  category,
  note,
  date,
  type,
  accounts,
  transactions,
  categories,
  activeBudget,
  beforeBudget,
  afterBudget,
  formatMoney,
  onModeChange,
  onQuickTextChange,
  onReadQuick,
  onNameChange,
  onKindChange,
  onOpeningChange,
  onAmountChange,
  onAccountChange,
  onDestinationChange,
  onCategoryChange,
  onNoteChange,
  onDateChange,
  onTypeChange,
  onSubmit,
}: Props) {
  const title =
    mode === "quick" ? "Catat Cepat" :
    editing ? "Edit " + (mode === "account" ? "Akun" : mode === "budget" ? "Budget" : "Transaksi") :
    mode === "account" ? "Tambah Akun" :
    mode === "budget" ? "Tambah Budget" :
    "Catat Transaksi";

  const description =
    mode === "quick" ? "Tulis satu transaksi, lalu tinjau hasilnya sebelum menyimpan." :
    mode === "account" ? "Saldo awal hanya dapat diubah sebelum ada transaksi. Gunakan Cocokkan saldo untuk memperbaiki saldo terkini." :
    mode === "budget" ? "Batas berlaku setiap bulan." :
    "Periksa nominal dan akun sebelum menyimpan.";

  return (
    <Drawer open={mode !== null} onOpenChange={open => !open && onModeChange(null)} direction="bottom">
      <DrawerContent className="form-sheet">
        <DrawerHeader>
          <div className="drawer-heading">
            <DrawerTitle>{title}</DrawerTitle>
            <button aria-label="Tutup formulir" onClick={() => onModeChange(null)}>
              <X size={19} />
            </button>
          </div>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <div className="form-sheet-scroll" key={mode} data-vaul-no-drag>
          {mode === "quick" ? (
            <div className="quick-entry-form">
              <label htmlFor="quick-text">Apa transaksinya?</label>
              <textarea
                id="quick-text"
                autoFocus
                maxLength={150}
                value={quickText}
                onChange={event => onQuickTextChange(event.target.value)}
                placeholder="Contoh: beli kopi 25rb"
              />
              <p>Contoh lain: “gaji 4,5 juta” atau “transfer 200rb”. Kamu tetap memilih akun dan mengonfirmasi nominal.</p>
              <button className="save-button" type="button" onClick={onReadQuick}>
                Tinjau transaksi <ChevronRight size={18} />
              </button>
              <button className="manual-link" type="button" onClick={() => onModeChange("transaction")}>
                Isi formulir manual
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="form-body">
              {mode === "account" && (
                <>
                  <label>
                    Nama akun
                    <input
                      required
                      maxLength={50}
                      placeholder="Contoh: BCA, GoPay, Cash"
                      value={name}
                      onChange={event => onNameChange(event.target.value)}
                    />
                  </label>
                  <label>
                    Jenis akun
                    <Select value={kind} onValueChange={onKindChange}>
                      <SelectTrigger className="select-control"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="ewallet">E-Wallet</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Saldo awal (Rp)
                    <input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={opening}
                      disabled={!!editing && transactions.some(transaction => transaction.accountId === editing || transaction.toAccountId === editing)}
                      onChange={event => onOpeningChange(event.target.value)}
                    />
                  </label>
                </>
              )}

              {mode === "transaction" && (
                <>
                  <div className="type-pills">
                    {(["expense", "income", "transfer"] as const).map(item => (
                      <button
                        type="button"
                        className={type === item ? "chosen" : ""}
                        key={item}
                        onClick={() => onTypeChange(item)}
                      >
                        {item === "expense" ? "Pengeluaran" : item === "income" ? "Pemasukan" : "Transfer"}
                      </button>
                    ))}
                  </div>

                  <label>
                    Jumlah (Rp)
                    <input
                      required
                      autoFocus
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={amount}
                      onChange={event => onAmountChange(event.target.value)}
                    />
                  </label>

                  <label>
                    {type === "transfer" ? "Dari akun" : "Akun"}
                    <Select value={account} onValueChange={onAccountChange}>
                      <SelectTrigger className="select-control"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>

                  {type === "transfer" ? (
                    <label>
                      Ke akun
                      <Select value={destination} onValueChange={onDestinationChange}>
                        <SelectTrigger className="select-control"><SelectValue placeholder="Pilih akun tujuan" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(item => item.id !== account).map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  ) : (
                    <label>
                      Kategori
                      <Select value={category} onValueChange={onCategoryChange}>
                        <SelectTrigger className="select-control"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                  )}

                  <label>
                    Catatan
                    <input
                      maxLength={150}
                      placeholder="Contoh: Kopi pagi"
                      value={note}
                      onChange={event => onNoteChange(event.target.value)}
                    />
                  </label>
                  <label>
                    Tanggal
                    <input required type="date" value={date} onChange={event => onDateChange(event.target.value)} />
                  </label>

                  {activeBudget && (
                    <div className={"budget-insight " + (afterBudget >= activeBudget.amount ? "over" : afterBudget >= activeBudget.amount * .8 ? "near" : "")}>
                      <strong>Budget {category} · {date.slice(0, 7)}</strong>
                      <span>Terpakai {formatMoney(beforeBudget)} dari {formatMoney(activeBudget.amount)}</span>
                      <b>
                        {amount && Number(amount) > 0
                          ? afterBudget > activeBudget.amount
                            ? `Melewati batas ${formatMoney(afterBudget - activeBudget.amount)}`
                            : `Sisa setelah transaksi ${formatMoney(activeBudget.amount - afterBudget)}`
                          : `Sisa ${formatMoney(Math.max(0, activeBudget.amount - beforeBudget))}`}
                      </b>
                    </div>
                  )}
                </>
              )}

              {mode === "budget" && (
                <>
                  <label>
                    Kategori
                    <Select value={category} onValueChange={onCategoryChange}>
                      <SelectTrigger className="select-control"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.filter(item => item !== "Gaji").map(item => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Budget bulanan (Rp)
                    <input
                      required
                      autoFocus
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={amount}
                      onChange={event => onAmountChange(event.target.value)}
                    />
                  </label>
                </>
              )}

              <button className="save-button" type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan"} <Check size={18} />
              </button>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
