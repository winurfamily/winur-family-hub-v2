"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, EmptyState } from "@/components/finance/ui";
import { ItemFieldsRow, UnitDatalist, parseQty, type ItemDraft } from "@/components/finance/item-fields";
import { scanReceiptDocument, type ScannedReceiptLine } from "@/app/actions/scan";
import { importReceiptAsPlan, uploadReceiptDocument } from "@/app/actions/receipt-import";
import { reconcileReceipt } from "@/lib/receipt-reconcile";
import { formatRupiah } from "@/lib/format";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/shopping-item";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

interface ReviewLine extends ItemDraft {
  position: number;
  lineTotal: number;
  discount: number;
  review: string[];
}

interface Draft {
  merchant: string;
  address: string;
  date: string;
  time: string;
  refNo: string;
  lines: ReviewLine[];
  printedSubtotal: number;
  printedDiscount: number;
  printedVoucher: number;
  printedTotal: number;
  printedItemCount: number;
  fingerprint: string;
  storagePath?: string;
  planName: string;
}

/** Baca berkas sebagai data URL tanpa menuliskannya ke mana pun. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.readAsDataURL(file);
  });
}

/**
 * Impor struk (PDF berhalaman banyak atau foto) menjadi RENCANA BARU.
 *
 * Alurnya sengaja tiga langkah dan tidak bisa dipotong:
 *
 *   unggah  →  TINJAU  →  simpan sebagai rencana draft
 *
 * Tidak ada satu pun angka yang masuk database sebelum langkah ketiga, dan
 * langkah ketiga TIDAK membuat transaksi maupun mengurangi saldo — ia hanya
 * melahirkan satu rencana baru. Uang baru berpindah lewat "Selesaikan
 * Belanja" pada rencana itu, seperti rencana lainnya.
 *
 * Layar tinjau menampilkan dua hal yang biasanya disembunyikan aplikasi lain:
 * baris mana yang pembacaannya meragukan, dan SELISIH antara hasil ekstraksi
 * dengan angka yang benar-benar tercetak di struk. Keduanya ditampilkan apa
 * adanya — tidak ada angka yang dirapikan diam-diam agar terlihat cocok.
 */
export function ReceiptImport() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "scanning" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef(false);

  const busy = phase !== "idle" || isPending;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("Berkas melebihi 10 MB.");
      return;
    }

    startTransition(async () => {
      try {
        setPhase("reading");
        const dataUrl = await readAsDataUrl(file);

        // Struk diunggah ke bucket privat LEBIH DULU, supaya berkasnya tetap
        // tersimpan (dan sidik jarinya diketahui) walau pembacaan AI gagal.
        const uploaded = await uploadReceiptDocument({
          dataUrl,
          mimeType: file.type || "application/pdf",
        });
        if (!uploaded.success || !uploaded.data) {
          setError(uploaded.error ?? "Gagal mengunggah struk.");
          setPhase("idle");
          return;
        }

        setPhase("scanning");
        const scan = await scanReceiptDocument({ dataUrl, filename: file.name });

        if (!scan.success || !scan.lines) {
          setError(scan.error ?? "Gagal membaca struk.");
          setPhase("idle");
          return;
        }

        setDraft(toDraft(scan, uploaded.data.fingerprint, uploaded.data.storagePath, file.name));
        setPhase("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memproses berkas.");
        setPhase("idle");
      }
    });
  };

  const patchLine = (key: string, patch: Partial<ReviewLine>) =>
    setDraft((current) =>
      current
        ? { ...current, lines: current.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }
        : current
    );

  const removeLine = (key: string) =>
    setDraft((current) =>
      current ? { ...current, lines: current.lines.filter((l) => l.key !== key) } : current
    );

  const reconciled = useMemo(() => {
    if (!draft) return null;
    return reconcileReceipt({
      lines: draft.lines.map((l) => ({
        qty: parseQty(l.qty),
        price: l.price,
        lineTotal: l.lineTotal,
        discount: l.discount,
        review: l.review,
      })),
      printedSubtotal: draft.printedSubtotal,
      printedDiscount: draft.printedDiscount,
      printedVoucher: draft.printedVoucher,
      printedTotal: draft.printedTotal,
      printedItemCount: draft.printedItemCount,
    });
  }, [draft]);

  const save = () => {
    if (!draft || busy || tokenRef.current) return;
    if (!draft.planName.trim()) return setError("Nama rencana wajib diisi.");
    if (draft.lines.length === 0) return setError("Tidak ada barang untuk disimpan.");

    tokenRef.current = true;
    setError(null);

    startTransition(async () => {
      setPhase("saving");
      const result = await importReceiptAsPlan({
        name: draft.planName.trim(),
        merchant: draft.merchant,
        date: draft.date,
        refNo: draft.refNo,
        lines: draft.lines.map((l) => ({
          name: l.name.trim(),
          qty: parseQty(l.qty),
          unit: l.unit,
          price: l.price,
          discount: l.discount,
          needsReview: l.review.length > 0,
        })),
        printedTotal: draft.printedTotal,
        printedDiscount: draft.printedDiscount,
        printedVoucher: draft.printedVoucher,
        fileFingerprint: draft.fingerprint,
        storagePath: draft.storagePath,
      });

      tokenRef.current = false;
      setPhase("idle");

      if (!result.success || !result.data) {
        setError(result.error ?? "Gagal menyimpan rencana.");
        toast.error(result.error ?? "Gagal menyimpan rencana.");
        return;
      }

      if (result.data.duplicate) {
        toast.info("Struk ini sudah pernah diimpor. Membuka rencana yang sudah ada.");
      } else {
        toast.success(`Rencana baru dibuat dengan ${result.data.itemCount} barang.`);
      }
      router.push(`/admin/belanja/${result.data.planId}`);
    });
  };

  // ---------------------------------------------------------------- unggah
  if (!draft) {
    return (
      <Panel className="p-4">
        <div className="flex items-start gap-2.5">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h3 className="font-heading text-[15px] font-black text-ink-1">Impor struk jadi rencana</h3>
            <p className="mt-0.5 text-[12px] font-semibold text-ink-3">
              Unggah PDF struk (semua halaman dibaca) atau fotonya. Hasilnya jadi rencana baru
              berstatus draft — saldo belum berkurang sampai kamu menyelesaikannya.
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <GameButton
          type="button"
          variant="primary"
          block
          className="mt-3.5"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {phase === "scanning" ? "Membaca seluruh halaman…" : "Menyiapkan…"}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden /> Pilih Berkas Struk
            </>
          )}
        </GameButton>

        {error && (
          <p role="alert" className="mt-2.5 text-sm font-bold text-destructive">
            {error}
          </p>
        )}
      </Panel>
    );
  }

  // ---------------------------------------------------------------- tinjau
  return (
    <div className="space-y-3">
      <UnitDatalist />

      <Panel className="p-4">
        <h3 className="font-heading text-[15px] font-black text-ink-1">Tinjau hasil pembacaan</h3>
        <p className="mt-0.5 text-[12px] font-semibold text-ink-3">
          Perbaiki dulu yang perlu. Belum ada yang tersimpan sampai kamu menekan tombol di bawah.
        </p>

        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="import-name">Nama rencana</Label>
            <Input
              id="import-name"
              value={draft.planName}
              onChange={(e) => setDraft({ ...draft, planName: e.target.value })}
              maxLength={60}
              disabled={busy}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-merchant">Toko</Label>
              <Input
                id="import-merchant"
                value={draft.merchant}
                onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
                maxLength={80}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-date">Tanggal struk</Label>
              <Input
                id="import-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                disabled={busy}
              />
            </div>
          </div>
          {(draft.address || draft.refNo || draft.time) && (
            <p className="text-[11px] font-semibold text-ink-3">
              {[draft.address, draft.time && `Jam ${draft.time}`, draft.refNo && `Ref ${draft.refNo}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </Panel>

      {/* Pencocokan dengan angka yang tercetak di struk. */}
      {reconciled && (
        <Panel className={cn("p-4", !reconciled.balanced && "border-2 border-destructive/40")}>
          <div className="flex items-center gap-2">
            {reconciled.balanced ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary-dark" aria-hidden />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
            )}
            <h3 className="font-heading text-[15px] font-black text-ink-1">
              {reconciled.balanced ? "Cocok dengan struk" : "Ada yang tidak cocok"}
            </h3>
          </div>

          <ul className="mt-2.5 space-y-1 text-[13px]">
            {reconciled.checks.map((check) => (
              <li key={check.label} className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-ink-3">{check.label}</span>
                <span className="tabular shrink-0 font-bold text-ink-2">
                  {check.label === "Jumlah item"
                    ? `${check.extracted} / ${check.printed}`
                    : `${formatRupiah(check.extracted)} / ${formatRupiah(check.printed)}`}
                  {!check.matched && (
                    <span className="ml-1.5 font-black text-destructive">
                      ({check.difference > 0 ? "+" : "−"}
                      {check.label === "Jumlah item"
                        ? Math.abs(check.difference)
                        : formatRupiah(Math.abs(check.difference))}
                      )
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[11px] font-semibold text-ink-3">
            Angka kiri = hasil pembacaan, kanan = yang tercetak di struk.
            {reconciled.reviewCount > 0 && (
              <>
                {" "}
                <strong className="text-ink-2">
                  {reconciled.reviewCount} baris perlu ditinjau.
                </strong>
              </>
            )}
          </p>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <div className="border-b border-border px-3 py-2.5 sm:px-4">
          <h3 className="font-heading text-sm font-black text-ink-1">
            Barang ({draft.lines.length}) — urutan mengikuti struk
          </h3>
        </div>

        {draft.lines.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Tidak ada barang" text="Semua baris sudah dihapus." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {draft.lines.map((line, index) => (
              <li
                key={line.key}
                className={cn("p-3 sm:p-4", line.review.length > 0 && "bg-destructive/5")}
              >
                <div className="flex items-start gap-2">
                  <span className="tabular mt-2.5 w-7 shrink-0 text-[11px] font-black text-ink-3">
                    {String(line.position).padStart(3, "0")}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={line.name}
                        onChange={(e) => patchLine(line.key, { name: e.target.value })}
                        maxLength={MAX_ITEM_NAME_LENGTH}
                        aria-label={`Nama barang ${index + 1}`}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={busy}
                        aria-label={`Hapus barang ${index + 1}`}
                        className="tap-target grid shrink-0 place-items-center rounded-xl text-destructive active:bg-destructive/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    <ItemFieldsRow
                      index={index}
                      draft={line}
                      disabled={busy}
                      priceLabel="Harga satuan"
                      onPatch={(patch) => patchLine(line.key, patch)}
                    />

                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] font-semibold">
                      <span className="text-ink-3">
                        Subtotal{" "}
                        <strong className="tabular text-ink-2">
                          {formatRupiah(Math.round(parseQty(line.qty) * line.price))}
                        </strong>
                        {line.discount > 0 && (
                          <> · diskon {formatRupiah(line.discount)}</>
                        )}
                        {line.lineTotal > 0 && <> · struk {formatRupiah(line.lineTotal)}</>}
                      </span>
                    </div>

                    {line.review.length > 0 && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-bold text-destructive">
                        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Perlu ditinjau — {line.review.join("; ")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {error && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <GameButton type="button" variant="primary" block disabled={busy} onClick={save}>
          {phase === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
            </>
          ) : (
            "Simpan sebagai Rencana Baru"
          )}
        </GameButton>
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
          disabled={busy}
          className="tap-target shrink-0 rounded-xl border-2 border-border bg-card px-4 text-[13px] font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-40"
        >
          Batal
        </button>
      </div>

      <p className="text-center text-[11px] font-semibold text-ink-3">
        Menyimpan hanya membuat rencana baru berstatus draft. Rencana lain tidak tersentuh, dan saldo
        belum berkurang.
      </p>
    </div>
  );
}

/** Ubah hasil scan menjadi draft yang bisa disunting di layar tinjau. */
function toDraft(
  scan: {
    merchant?: string;
    address?: string;
    date?: string;
    time?: string;
    refNo?: string;
    lines?: ScannedReceiptLine[];
    printedSubtotal?: number;
    printedDiscount?: number;
    printedVoucher?: number;
    printedTotal?: number;
    printedItemCount?: number;
  },
  fingerprint: string,
  storagePath: string,
  filename: string
): Draft {
  const merchant = scan.merchant?.trim() || "";
  const date = scan.date ?? "";

  // Nama rencana diusulkan dari merchant + bulan struk, tetapi tetap bisa
  // diubah — nama yang salah baca jangan sampai mengunci judul rencana.
  const monthLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : "";
  const suggested = merchant
    ? `Hasil Belanja ${merchant}${monthLabel ? ` - ${monthLabel}` : ""}`
    : filename.replace(/\.[^.]+$/, "");

  return {
    merchant,
    address: scan.address ?? "",
    date,
    time: scan.time ?? "",
    refNo: scan.refNo ?? "",
    lines: (scan.lines ?? []).map((line) => ({
      key: `${line.position}-${crypto.randomUUID()}`,
      position: line.position,
      name: line.name,
      qty: String(line.qty),
      unit: line.unit,
      price: line.price,
      lineTotal: line.lineTotal,
      discount: line.discount,
      review: line.review,
    })),
    printedSubtotal: scan.printedSubtotal ?? 0,
    printedDiscount: scan.printedDiscount ?? 0,
    printedVoucher: scan.printedVoucher ?? 0,
    printedTotal: scan.printedTotal ?? 0,
    printedItemCount: scan.printedItemCount ?? 0,
    fingerprint,
    storagePath,
    planName: suggested.slice(0, 60),
  };
}
