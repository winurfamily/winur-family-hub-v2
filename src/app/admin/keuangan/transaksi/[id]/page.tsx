import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { getShoppingTransaction } from "@/app/actions/belanja";
import { GameButton } from "@/components/ui/game-button";
import { ReceiptViewer } from "../../_components/receipt-viewer";
import { DeleteTransactionButton } from "../../_components/delete-transaction-button";
import { ItemLine } from "@/components/finance/item-line";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/supabase/types";
import { formatRupiah, formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Input manual",
  scan: "Scan AI",
  plan: "Dari rencana belanja",
};

export default async function BelanjaDetailPage({ params }: { params: { id: string } }) {
  const trx = await getShoppingTransaction(params.id);
  if (!trx) notFound();

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/admin/keuangan"
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Keuangan
        </Link>

        <div className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#256F2A]">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Tersimpan
          </p>
          <h1 className="mt-1 break-words font-heading text-xl font-black text-ink-1">{trx.merchant}</h1>
          <p className="tabular mt-1 break-words font-mono text-3xl font-bold text-ink-1">
            {formatRupiah(trx.total)}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t-2 border-border pt-3 text-xs">
            <Field label="Tanggal" value={formatDate(trx.date)} />
            <Field label="Kategori" value={EXPENSE_CATEGORY_LABELS[trx.category]} />
            <Field label="Sumber dana" value={trx.pocketName} />
            <Field label="Sumber input" value={SOURCE_LABEL[trx.source] ?? trx.source} />
            <Field label="Dicatat oleh" value={trx.createdByName} />
            <Field label="Waktu dicatat" value={formatDateTime(trx.createdAt)} />
          </dl>

          {trx.note && (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-2">
              {trx.note}
            </p>
          )}
        </div>
      </header>

      <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <h2 className="mb-3 font-heading text-base font-black text-ink-1">
          Barang ({trx.items.length})
        </h2>
        <ul className="divide-y divide-border">
          {trx.items.map((item) => (
            <li key={item.id} className="py-2.5">
              {/* Bentuk yang sama dengan checklist & pratinjau tempel daftar:
                  nama sebagai informasi utama, jumlah + satuan sebagai lencana. */}
              <ItemLine
                name={item.name}
                qty={item.qty}
                unit={item.unit}
                meta={`${formatRupiah(item.price)} / satuan`}
                trailing={
                  <p className="tabular shrink-0 pl-2 text-[13px] font-extrabold text-ink-1">
                    {formatRupiah(item.subtotal)}
                  </p>
                }
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-baseline justify-between border-t-2 border-border pt-3">
          <span className="text-sm font-extrabold text-ink-2">Total</span>
          <span className="tabular font-mono text-lg font-bold text-ink-1">{formatRupiah(trx.total)}</span>
        </p>
      </section>

      {trx.receipts.length > 0 && (
        <section className="space-y-2 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <h2 className="font-heading text-base font-black text-ink-1">Bukti Struk</h2>
          {trx.receipts.map((receipt) => (
            <ReceiptViewer key={receipt.id} receiptId={receipt.id} fileSize={receipt.fileSize} />
          ))}
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <GameButton asChild variant="outline" block>
          <Link href="/admin/keuangan">Kembali ke Keuangan</Link>
        </GameButton>
        <DeleteTransactionButton
          transactionId={trx.id}
          merchant={trx.merchant}
          total={trx.total}
          accountName={trx.pocketName}
          hasReceipt={trx.receipts.length > 0}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-ink-1">{value}</dd>
    </div>
  );
}
