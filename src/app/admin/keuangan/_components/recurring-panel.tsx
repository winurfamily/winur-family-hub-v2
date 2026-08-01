"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipForward,
  Trash2,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { CategoryBadge } from "@/components/finance/category-picker";
import { Panel, SectionTitle, EmptyState, StatTile } from "@/components/finance/ui";
import { RecurringFormSheet } from "./recurring-form-sheet";
import {
  confirmRecurringOccurrence,
  skipRecurringOccurrence,
  snoozeRecurringOccurrence,
  deleteRecurring,
  setRecurringActive,
  type OccurrenceView,
  type RecurringOverview,
  type RecurringView,
} from "@/app/actions/rutin";
import { expenseVisual, incomeVisual } from "@/lib/finance-categories";
import { formatDate, formatRupiah } from "@/lib/format";
import { FREQUENCY_LABELS, daysBetween, dueLabel } from "@/lib/recurring";
import { cn } from "@/lib/utils";

/**
 * Tab RUTIN — dua bagian yang sengaja dipisah tegas.
 *
 *  1. "Menunggu konfirmasi" di ATAS: tagihan yang jatuh tempo hari ini atau
 *     dalam waktu dekat. Inilah satu-satunya alasan tab ini dibuka pada hari
 *     biasa, jadi ia tidak boleh berada di bawah daftar jadwal yang panjang.
 *  2. "Jadwal" di bawah: pengaturan yang jarang disentuh setelah dibuat.
 *
 * Tidak ada tagihan yang memotong saldo sendiri. Setiap baris di bagian 1
 * menyatakan nominalnya dan menunggu ketukan Konfirmasi — dan tombol itu
 * dikunci selama proses berjalan sehingga klik ganda tidak bisa menghasilkan
 * dua transaksi (penjaga keduanya ada di server lewat client_token).
 */
export function RecurringPanel({
  overview,
  pockets,
}: {
  overview: RecurringOverview;
  pockets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (!overview.ready) {
    return (
      <Panel className="p-4">
        <SectionTitle icon={<CalendarClock className="h-[18px] w-[18px]" />} title="Transaksi Rutin" />
        <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs font-semibold leading-relaxed text-ink-2">
          Fitur ini butuh{" "}
          <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
            supabase/migrations/0025_adjustment_recurring_shopping.sql
          </code>{" "}
          dijalankan di SQL Editor Supabase, lalu buka halaman ini lagi. Menu Keuangan lainnya tetap
          berjalan normal tanpa migration ini.
        </p>
      </Panel>
    );
  }

  const active = overview.schedules.filter((s) => s.isActive);
  const paused = overview.schedules.filter((s) => !s.isActive);
  const overdue = overview.upcoming.filter((o) => o.dueDate <= overview.today);

  const monthlyLoad = active
    .filter((s) => s.kind === "expense" && s.frequency === "monthly")
    .reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionTitle
          icon={<CalendarClock className="h-[18px] w-[18px]" />}
          title="Transaksi Rutin"
          action={
            <RecurringFormSheet
              pockets={pockets}
              trigger={
                <button
                  type="button"
                  className="tap-target flex items-center gap-1 rounded-xl bg-primary-light px-3 text-xs font-black text-primary transition-transform duration-150 active:scale-95"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Jadwal
                </button>
              }
            />
          }
        />
        <p className="mt-1 text-[11px] font-semibold text-ink-3">
          Gaji, cicilan, listrik, internet, sekolah, langganan. Jadwal hanya mengingatkan — saldo
          berubah setelah kamu konfirmasi.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile label="Jadwal aktif" value={String(active.length)} />
          <StatTile
            label="Menunggu"
            value={String(overview.upcoming.length)}
            tone={overdue.length > 0 ? "bad" : "neutral"}
            hint={overdue.length > 0 ? `${overdue.length} terlambat` : undefined}
          />
          <StatTile label="Beban bulanan" value={monthlyLoad} />
        </div>
      </Panel>

      {/* -------- 1. Menunggu konfirmasi -------- */}
      <Panel className="p-4">
        <SectionTitle
          icon={<AlarmClock className="h-[18px] w-[18px]" />}
          title={`Menunggu Konfirmasi (${overview.upcoming.length})`}
        />

        <div className="mt-3">
          {overview.upcoming.length === 0 ? (
            <EmptyState
              title="Tidak ada yang jatuh tempo"
              text="Tagihan muncul di sini beberapa hari sebelum tanggalnya, jadi masih sempat menyiapkan dana."
            />
          ) : (
            <ul className="space-y-2.5">
              {overview.upcoming.map((occurrence) => (
                <OccurrenceCard
                  key={occurrence.id}
                  occurrence={occurrence}
                  today={overview.today}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* -------- 2. Jadwal -------- */}
      <Panel className="p-4">
        <SectionTitle icon={<Clock className="h-[18px] w-[18px]" />} title="Semua Jadwal" />

        <div className="mt-3">
          {overview.schedules.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi rutin"
              text="Buat jadwal untuk gaji, cicilan, listrik, internet, atau langganan agar tidak perlu diingat sendiri tiap bulan."
              action={
                <RecurringFormSheet
                  pockets={pockets}
                  trigger={
                    <GameButton type="button" variant="primary" size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" aria-hidden /> Buat Jadwal
                    </GameButton>
                  }
                />
              }
            />
          ) : (
            <ul className="grid gap-2.5 md:grid-cols-2">
              {[...active, ...paused].map((schedule) => (
                <li key={schedule.id}>
                  <ScheduleCard schedule={schedule} pockets={pockets} onChanged={refresh} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}

function OccurrenceCard({
  occurrence,
  today,
  onChanged,
}: {
  occurrence: OccurrenceView;
  today: string;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"confirm" | "skip" | "snooze" | null>(null);

  const late = daysBetween(today, occurrence.dueDate) < 0;
  const visual =
    occurrence.kind === "income"
      ? incomeVisual(occurrence.categoryKey)
      : expenseVisual(occurrence.categoryKey);

  const run = (
    action: "confirm" | "skip" | "snooze",
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ) => {
    // Penjaga klik ganda di sisi klien. Penjaga sungguhannya ada di server:
    // konfirmasi memakai id tagihan sebagai client_token, jadi pengiriman
    // kedua mengembalikan transaksi yang sama.
    if (isPending) return;
    setBusy(action);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (!result.success) {
        toast.error(result.error ?? "Tindakan gagal.");
        return;
      }
      toast.success(successMessage);
      onChanged();
    });
  };

  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-3",
        late ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-2.5">
        <CategoryBadge visual={visual} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-black text-ink-1">{occurrence.name}</p>
            <p
              className={cn(
                "tabular shrink-0 text-[14px] font-black",
                occurrence.kind === "income" ? "text-secondary-dark" : "text-destructive"
              )}
            >
              {occurrence.kind === "income" ? "+" : "−"}
              {formatRupiah(occurrence.amount)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-3">
            {formatDate(occurrence.dueDate)} · {occurrence.accountName} · {occurrence.categoryLabel}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] font-black",
              late ? "text-destructive" : "text-ink-2"
            )}
          >
            {dueLabel(occurrence.dueDate, today)}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(
              "confirm",
              () => confirmRecurringOccurrence(occurrence.id),
              `${occurrence.name} tercatat di Keuangan.`
            )
          }
          className="tap-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-black text-white transition-transform duration-150 active:scale-95 disabled:opacity-50"
        >
          {busy === "confirm" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          Konfirmasi
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(
              "snooze",
              () => snoozeRecurringOccurrence(occurrence.id, 3),
              "Tagihan ditunda 3 hari."
            )
          }
          aria-label={`Tunda ${occurrence.name} 3 hari`}
          className="tap-target flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-[12px] font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-50"
        >
          {busy === "snooze" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Clock className="h-3.5 w-3.5" aria-hidden />
          )}
          Tunda
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run("skip", () => skipRecurringOccurrence(occurrence.id), "Tagihan dilewati.")
          }
          aria-label={`Lewati ${occurrence.name}`}
          className="tap-target flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-[12px] font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-50"
        >
          {busy === "skip" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <SkipForward className="h-3.5 w-3.5" aria-hidden />
          )}
          Lewati
        </button>
      </div>
    </li>
  );
}

function ScheduleCard({
  schedule,
  pockets,
  onChanged,
}: {
  schedule: RecurringView;
  pockets: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const visual =
    schedule.kind === "income" ? incomeVisual(schedule.categoryKey) : expenseVisual(schedule.categoryKey);

  const toggle = () =>
    startTransition(async () => {
      const result = await setRecurringActive(schedule.id, !schedule.isActive);
      if (!result.success) {
        toast.error(result.error ?? "Gagal mengubah status jadwal.");
        return;
      }
      toast.success(schedule.isActive ? "Jadwal dinonaktifkan." : "Jadwal diaktifkan.");
      onChanged();
    });

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border-2 border-border bg-card p-3",
        !schedule.isActive && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5">
        <CategoryBadge visual={visual} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-black text-ink-1">{schedule.name}</p>
            <p
              className={cn(
                "tabular shrink-0 text-[13px] font-black",
                schedule.kind === "income" ? "text-secondary-dark" : "text-destructive"
              )}
            >
              {schedule.kind === "income" ? "+" : "−"}
              {formatRupiah(schedule.amount)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-3">
            {FREQUENCY_LABELS[schedule.frequency]} · {schedule.accountName} · {schedule.categoryLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-ink-2">
            {schedule.isActive ? (
              <>
                <ChevronRight className="h-3 w-3 text-primary" aria-hidden />
                Berikutnya {formatDate(schedule.nextDate)}
              </>
            ) : (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-black uppercase text-ink-3">
                Nonaktif
              </span>
            )}
          </p>
          {schedule.endDate && (
            <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
              Berakhir {formatDate(schedule.endDate)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-1.5 pt-2.5">
        <RecurringFormSheet
          pockets={pockets}
          schedule={schedule}
          onSaved={onChanged}
          trigger={
            <button
              type="button"
              aria-label={`Ubah jadwal ${schedule.name}`}
              className="tap-target grid place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          }
        />

        <button
          type="button"
          disabled={isPending}
          onClick={toggle}
          aria-label={`${schedule.isActive ? "Nonaktifkan" : "Aktifkan"} jadwal ${schedule.name}`}
          className="tap-target grid place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-50"
        >
          {schedule.isActive ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </button>

        <ConfirmDialog
          title="Hapus jadwal rutin?"
          message={`Jadwal "${schedule.name}" beserta tagihan yang belum dikonfirmasi akan dihapus. Transaksi yang sudah terlanjur dikonfirmasi TIDAK ikut terhapus dan saldo tidak berubah.`}
          successMessage="Jadwal dihapus."
          onConfirm={() => deleteRecurring(schedule.id)}
          onDone={onChanged}
          trigger={
            <button
              type="button"
              aria-label={`Hapus jadwal ${schedule.name}`}
              className="tap-target grid place-items-center rounded-xl border-2 border-border bg-card text-destructive transition-colors active:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          }
        />
      </div>
    </div>
  );
}
