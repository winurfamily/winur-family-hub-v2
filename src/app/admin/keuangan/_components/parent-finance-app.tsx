"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  FolderCog,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Target,
  Wallet,
  XCircle,
} from "lucide-react";
import { BelanjaRiwayat } from "./belanja-riwayat";
import { BelanjaScan } from "./belanja-scan";
import { IncomeFormSheet } from "./income-form-sheet";
import { PocketDialog } from "./pocket-dialog";
import { PocketList } from "./pocket-list";
import { RencanaView } from "./rencana-view";
import { ShoppingForm } from "./shopping-form";
import { TransferForm } from "./transfer-form";
import { TransferHistoryList } from "./transfer-history";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { ResponsiveSheet, ResponsiveSheetContent, ResponsiveSheetTrigger } from "@/components/finance/responsive-sheet";
import { completeShoppingPlan, setPlanItemStatus, type PlanView } from "@/app/actions/rencana";
import type { FinanceSummary, TransferHistoryResult } from "@/app/actions/keuangan";
import type { LedgerEntry, LedgerResult } from "@/app/actions/riwayat";
import type { ShoppingHistoryResult } from "@/app/actions/belanja";
import { cn } from "@/lib/utils";
import { formatDate, formatRupiah, todayISODate } from "@/lib/format";

type MainTab = "buku" | "dompet" | "belanja" | "analitik" | "lainnya";
type ShopTab = "rencana" | "checklist" | "selesai" | "manual" | "scan" | "riwayat";

const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  { id: "buku", label: "Buku", icon: <BookOpen className="h-5 w-5" /> },
  { id: "dompet", label: "Dompet", icon: <Wallet className="h-5 w-5" /> },
  { id: "belanja", label: "Belanja", icon: <ShoppingCart className="h-5 w-5" /> },
  { id: "analitik", label: "Analitik", icon: <BarChart3 className="h-5 w-5" /> },
  { id: "lainnya", label: "Lainnya", icon: <MoreHorizontal className="h-5 w-5" /> },
];

const SHOP_TABS: { id: ShopTab; label: string; icon: React.ReactNode }[] = [
  { id: "rencana", label: "Rencana", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "checklist", label: "Checklist", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "selesai", label: "Selesai", icon: <ReceiptText className="h-4 w-4" /> },
  { id: "manual", label: "Manual", icon: <ShoppingBag className="h-4 w-4" /> },
  { id: "scan", label: "Scan", icon: <Camera className="h-4 w-4" /> },
  { id: "riwayat", label: "Riwayat", icon: <FileText className="h-4 w-4" /> },
];

export function ParentFinanceApp({
  month,
  summary,
  ledger,
  options,
  plans,
  shoppingHistory,
  transfers,
}: {
  month: string;
  summary: FinanceSummary | null;
  ledger: LedgerResult;
  options: { pockets: { id: string; name: string }[]; creators: { id: string; name: string }[] };
  plans: PlanView[];
  shoppingHistory: ShoppingHistoryResult;
  transfers: TransferHistoryResult;
}) {
  const [tab, setTab] = useState<MainTab>("buku");
  const [shopTab, setShopTab] = useState<ShopTab>("rencana");
  const income = ledger.totals.income;
  const expense = ledger.totals.expense;
  const diff = income - expense;
  const pockets = summary?.pockets ?? [];

  const title = MAIN_TABS.find((item) => item.id === tab)?.label ?? "Buku";

  return (
    <div className="parent-finance-app -mx-5 -my-5 min-h-screen-dvh bg-[#fff7fa] text-[#3b3036]">
      <div className="mx-auto min-h-screen-dvh w-full max-w-[520px] bg-white pb-[calc(96px+env(safe-area-inset-bottom))] shadow-card-deep lg:max-w-5xl">
        <header className="relative overflow-hidden bg-[#ef5b93] px-5 pb-7 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-35">
            <div className="absolute -left-20 top-16 h-72 w-72 rounded-full border border-white/45" />
            <div className="absolute right-8 top-16 h-24 w-24 rounded-full bg-white/10" />
          </div>
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/assets/branding/winur-logo-icon.svg" alt="" className="h-11 w-11 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Winur Family Hub</p>
                <h1 className="truncate font-heading text-3xl font-black">{title}</h1>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cari transaksi"
              onClick={() => setTab("buku")}
              className="tap-target grid rounded-2xl bg-white/14 text-white backdrop-blur transition active:scale-95"
            >
              <Search className="m-auto h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2 rounded-[22px] bg-white/15 p-2 backdrop-blur">
            <HeaderMetric label="Pendapatan" value={income} tone="good" />
            <HeaderMetric label="Pengeluaran" value={expense} tone="bad" />
            <HeaderMetric label="Selisih" value={diff} tone={diff >= 0 ? "good" : "bad"} />
          </div>
        </header>

        <main className="-mt-4 space-y-4 rounded-t-[30px] bg-white px-4 pt-5 lg:grid lg:grid-cols-[1fr_360px] lg:gap-5 lg:space-y-0 lg:px-5">
          <section className="min-w-0 space-y-4">
            {tab === "buku" && <BukuTab month={month} ledger={ledger} />}
            {tab === "dompet" && (
              <DompetTab summary={summary} transfers={transfers} pockets={pockets} saldoUtama={summary?.saldoUtama ?? 0} />
            )}
            {tab === "belanja" && (
              <BelanjaTab
                active={shopTab}
                setActive={setShopTab}
                plans={plans}
                pockets={pockets}
                saldoUtama={summary?.saldoUtama ?? 0}
                month={month}
                shoppingHistory={shoppingHistory}
              />
            )}
            {tab === "analitik" && <AnalitikTab ledger={ledger} shoppingHistory={shoppingHistory} />}
            {tab === "lainnya" && <LainnyaTab />}
          </section>

          <aside className="hidden space-y-4 lg:block">
            <QuickActions pockets={options.pockets} setTab={setTab} setShopTab={setShopTab} />
            <SavingsPreview summary={summary} />
          </aside>
        </main>
      </div>

      <QuickFab pockets={options.pockets} setTab={setTab} setShopTab={setShopTab} />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-[#f6d8e4] bg-white/95 px-2 pt-2 shadow-[0_-10px_30px_rgba(120,55,82,0.12)] backdrop-blur lg:max-w-5xl">
        <div className="grid grid-cols-5">
          {MAIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "tap-target flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-black transition",
                tab === item.id ? "bg-[#fff0f6] text-[#ef5b93]" : "text-[#998690] active:bg-[#fff7fa]"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function HeaderMetric({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/82 p-2.5 text-center text-[#3b3036]">
      <p className="truncate text-[10px] font-black uppercase text-[#9b7d8a]">{label}</p>
      <p className={cn("tabular mt-1 truncate text-xs font-black", tone === "good" ? "text-[#3ca85f]" : "text-[#f05a64]")}>
        {formatRupiah(value)}
      </p>
    </div>
  );
}

function BukuTab({ month, ledger }: { month: string; ledger: LedgerResult }) {
  const grouped = useMemo(() => groupByDate(ledger.entries), [ledger.entries]);
  const calendar = useMemo(() => buildCalendar(month, ledger.entries), [month, ledger.entries]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SectionTitle icon={<CalendarDays className="h-5 w-5" />} title="Kalender Transaksi" />
          <Input type="month" value={month} readOnly className="h-10 w-[150px] rounded-2xl border-[#f5c9d9]" />
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-[#a98c98]">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
            <span key={day}>{day}</span>
          ))}
          {calendar.map((day, index) => (
            <div key={`${day.date}-${index}`} className="min-h-[50px] rounded-2xl bg-[#fff7fa] p-1 text-left">
              {day.day && (
                <>
                  <p className="text-xs font-black text-[#5b4650]">{day.day}</p>
                  <div className="mt-1 space-y-0.5">
                    {day.income > 0 && <CalendarPill value={day.income} positive />}
                    {day.expense > 0 && <CalendarPill value={day.expense} />}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle icon={<BookOpen className="h-5 w-5" />} title="Buku Bulan Ini" />
          <Link href="/admin/keuangan/riwayat" className="text-xs font-black text-[#ef5b93]">
            Detail
          </Link>
        </div>
        {grouped.length === 0 ? (
          <EmptyState title="Belum ada transaksi" text="Semua ringkasan akan mulai hidup setelah Ayah atau Mamah mencatat pemasukan, transfer, atau belanja." />
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="rounded-2xl bg-[#f7f9fb] px-3 py-2 text-xs font-black text-[#9b7d8a]">
                  {formatDate(group.date)}
                </div>
                {group.items.map((entry) => (
                  <LedgerRow key={entry.key} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function DompetTab({
  summary,
  transfers,
  pockets,
  saldoUtama,
}: {
  summary: FinanceSummary | null;
  transfers: TransferHistoryResult;
  pockets: FinanceSummary["pockets"];
  saldoUtama: number;
}) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="bg-[#ef5b93] p-5 text-white">
          <p className="text-xs font-black uppercase text-white/75">Total saldo keluarga</p>
          <p className="tabular mt-1 font-mono text-4xl font-black">{formatRupiah(summary?.totalKeluarga ?? 0)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniBalance label="Saldo Utama" value={summary?.saldoUtama ?? 0} />
            <MiniBalance label="Total Pocket" value={summary?.totalPockets ?? 0} />
          </div>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle icon={<PiggyBank className="h-5 w-5" />} title="Pocket" />
            <PocketDialog
              trigger={
                <button className="tap-target rounded-2xl bg-[#fff0f6] px-3 text-xs font-black text-[#ef5b93]">
                  Tambah
                </button>
              }
            />
          </div>
          {pockets.length === 0 ? <EmptyState title="Pocket masih kosong" text="Buat pocket Belanja, Dana Sekolah, atau Tabungan keluarga." /> : <PocketList pockets={pockets} />}
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle icon={<ArrowRightLeft className="h-5 w-5" />} title="Transfer Dana" />
        <div className="mt-3">
          <TransferForm pockets={pockets} saldoUtama={saldoUtama} />
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle icon={<FileText className="h-5 w-5" />} title="Riwayat Transfer" />
        <p className="mt-1 text-xs font-bold text-[#9b7d8a]">Hapus riwayat tidak mengubah saldo.</p>
        <div className="mt-3">
          <TransferHistoryList items={transfers.items} />
        </div>
      </Card>
    </div>
  );
}

function BelanjaTab({
  active,
  setActive,
  plans,
  pockets,
  saldoUtama,
  month,
  shoppingHistory,
}: {
  active: ShopTab;
  setActive: (tab: ShopTab) => void;
  plans: PlanView[];
  pockets: FinanceSummary["pockets"];
  saldoUtama: number;
  month: string;
  shoppingHistory: ShoppingHistoryResult;
}) {
  return (
    <div className="space-y-4">
      <div className="scroll-no-bar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SHOP_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={cn(
              "tap-target flex shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-black",
              active === item.id ? "bg-[#ef5b93] text-white shadow-card" : "bg-[#fff0f6] text-[#9b6379]"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {active === "rencana" && <RencanaView plans={plans} pockets={pockets} />}
      {active === "checklist" && <ChecklistPanel plans={plans} />}
      {active === "selesai" && <CompletePlanPanel plans={plans} pockets={pockets} />}
      {active === "manual" && <ShoppingForm pockets={pockets} saldoUtama={saldoUtama} />}
      {active === "scan" && <BelanjaScan pockets={pockets} saldoUtama={saldoUtama} />}
      {active === "riwayat" && <BelanjaRiwayat initialMonth={month} initialData={shoppingHistory} />}
    </div>
  );
}

function ChecklistPanel({ plans }: { plans: PlanView[] }) {
  const activePlans = plans.filter((plan) => plan.status !== "done" && plan.status !== "cancelled" && plan.status !== "archived");
  const [planId, setPlanId] = useState(activePlans[0]?.id ?? "");
  const selected = activePlans.find((plan) => plan.id === planId) ?? activePlans[0];
  const [isPending, startTransition] = useTransition();

  const updateStatus = (itemId: string, status: "pending" | "bought" | "cancelled") => {
    startTransition(async () => {
      const result = await setPlanItemStatus(itemId, status);
      if (!result.success) toast.error(result.error ?? "Gagal memperbarui checklist.");
    });
  };

  if (!selected) return <EmptyState title="Tidak ada checklist aktif" text="Buat rencana belanja dulu, lalu gunakan mode checklist saat di toko." />;

  const sorted = [...selected.items].sort((a, b) => {
    const doneA = a.status === "bought" || a.status === "cancelled";
    const doneB = b.status === "bought" || b.status === "cancelled";
    return Number(doneA) - Number(doneB);
  });

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <Label>Pilih rencana</Label>
        <Select value={selected.id} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activePlans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 rounded-2xl bg-[#fff7fa] p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-black text-[#9b7d8a]">
          <span>{selected.boughtCount} dari {Math.max(0, selected.itemCount - selected.cancelledCount)} selesai</span>
          <span>{selected.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#ef5b93]" style={{ width: `${selected.progressPercent}%` }} />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {sorted.map((item) => (
          <div key={item.id} className={cn("rounded-2xl border-2 p-3", item.status === "bought" ? "border-[#7cc993] bg-[#effaf2]" : item.status === "cancelled" ? "border-[#e8e0e4] bg-[#f7f7f8]" : "border-[#f5c9d9] bg-white")}>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => updateStatus(item.id, item.status === "bought" ? "pending" : "bought")}
                className={cn("tap-target grid shrink-0 rounded-2xl border-2", item.status === "bought" ? "border-[#45a867] bg-[#45a867] text-white" : "border-[#f0b4cb] bg-[#fff7fa] text-[#ef5b93]")}
              >
                <CheckCircle2 className="m-auto h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("font-black", item.status !== "pending" && "text-[#9b8a91] line-through")}>{item.name}</p>
                <p className="text-xs font-bold text-[#9b7d8a]">{item.qty} x {formatRupiah(item.actualPrice ?? item.estimatedPrice)}</p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => updateStatus(item.id, item.status === "cancelled" ? "pending" : "cancelled")}
                className="tap-target grid rounded-2xl bg-[#fff0f6] px-3 text-[#ef5b93]"
                aria-label="Batalkan barang"
              >
                <XCircle className="m-auto h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompletePlanPanel({ plans, pockets }: { plans: PlanView[]; pockets: FinanceSummary["pockets"] }) {
  const candidates = plans.filter((plan) => plan.status !== "done" && plan.status !== "cancelled" && plan.items.some((item) => item.status !== "cancelled"));
  const [planId, setPlanId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((plan) => plan.id === planId) ?? candidates[0];
  const [source, setSource] = useState("main");
  const [merchant, setMerchant] = useState(selected?.name ?? "");
  const [date, setDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  if (!selected) return <EmptyState title="Belum ada rencana siap diselesaikan" text="Checklist yang selesai bisa diubah menjadi satu transaksi Belanja di sini." />;

  const items = selected.items.filter((item) => item.status !== "cancelled");
  const total = items.reduce((acc, item) => acc + Math.round(item.qty * (prices[item.id] ?? item.actualPrice ?? item.estimatedPrice)), 0);

  const submit = () => {
    if (isPending) return;
    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();
    startTransition(async () => {
      const result = await completeShoppingPlan({
        planId: selected.id,
        source,
        merchant: merchant.trim() || selected.name,
        date,
        note: note.trim() || undefined,
        actualPrices: prices,
        clientToken: tokenRef.current!,
      });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyelesaikan belanja.");
        return;
      }
      toast.success("Rencana selesai dan transaksi Belanja dibuat.");
      tokenRef.current = null;
    });
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-2">
        <Label>Rencana</Label>
        <Select value={selected.id} onValueChange={(value) => {
          setPlanId(value);
          setMerchant(candidates.find((plan) => plan.id === value)?.name ?? "");
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {candidates.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nama toko</Label>
          <Input value={merchant} onChange={(event) => setMerchant(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Sumber dana</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Saldo Utama</SelectItem>
            {pockets.map((pocket) => <SelectItem key={pocket.id} value={pocket.id}>{pocket.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-[#fff7fa] p-3">
            <p className="text-sm font-black">{item.name}</p>
            <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-2">
              <span className="text-xs font-bold text-[#9b7d8a]">{item.qty} x</span>
              <CurrencyInput value={prices[item.id] ?? item.actualPrice ?? item.estimatedPrice} onValueChange={(value) => setPrices((current) => ({ ...current, [item.id]: value }))} />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label>Catatan</Label>
        <Input value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <div className="rounded-2xl bg-[#ef5b93] p-4 text-white">
        <p className="text-xs font-black uppercase text-white/75">Total aktual</p>
        <p className="tabular font-mono text-2xl font-black">{formatRupiah(total)}</p>
      </div>
      <GameButton type="button" variant="primary" block disabled={isPending || total <= 0} onClick={submit}>
        {isPending ? "Memproses..." : "Selesaikan Belanja"}
      </GameButton>
    </Card>
  );
}

function AnalitikTab({ ledger, shoppingHistory }: { ledger: LedgerResult; shoppingHistory: ShoppingHistoryResult }) {
  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of ledger.entries.filter((item) => item.kind === "expense")) {
      const label = entry.categoryLabel ?? "Lainnya";
      totals.set(label, (totals.get(label) ?? 0) + entry.amount);
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [ledger.entries]);
  const max = Math.max(1, ...categories.map(([, value]) => value));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle icon={<BarChart3 className="h-5 w-5" />} title="Pendapatan vs Pengeluaran" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <AnalyticsBar label="Pendapatan" value={ledger.totals.income} max={Math.max(ledger.totals.income, ledger.totals.expense, 1)} className="bg-[#7bd88f]" />
          <AnalyticsBar label="Pengeluaran" value={ledger.totals.expense} max={Math.max(ledger.totals.income, ledger.totals.expense, 1)} className="bg-[#ef5b93]" />
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle icon={<Target className="h-5 w-5" />} title="Kategori Pengeluaran" />
        {categories.length === 0 ? (
          <EmptyState title="Chart masih Rp0" text="Analitik akan tampil setelah ada pengeluaran." />
        ) : (
          <div className="mt-4 space-y-3">
            {categories.map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs font-black">
                  <span>{label}</span>
                  <span>{formatRupiah(value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#f7f0f3]">
                  <div className="h-full rounded-full bg-[#ef5b93]" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="p-4">
        <SectionTitle icon={<ShoppingCart className="h-5 w-5" />} title="Analitik Belanja" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="Transaksi" value={String(shoppingHistory.count)} />
          <MiniStat label="Total Belanja" value={formatRupiah(shoppingHistory.total)} />
        </div>
      </Card>
    </div>
  );
}

function LainnyaTab() {
  const items = [
    { label: "Kategori transaksi", href: "/admin/keuangan/riwayat", icon: <FolderCog className="h-5 w-5" />, note: "Default income dan expense dipisah." },
    { label: "Budget bulanan", href: "/admin/keuangan/riwayat", icon: <Target className="h-5 w-5" />, note: "Script schema additive disiapkan." },
    { label: "Penyimpanan struk", href: "/admin/keuangan/storage", icon: <ReceiptText className="h-5 w-5" />, note: "Private bucket dan signed URL." },
    { label: "Export data", href: "/admin/keuangan/riwayat", icon: <Download className="h-5 w-5" />, note: "CSV riwayat terpadu." },
    { label: "Pengaturan", href: "/admin/dunia-anak/settings", icon: <Settings className="h-5 w-5" />, note: "Profil keluarga." },
    { label: "Akses Dunia Anak", href: "/admin/dunia-anak", icon: <Landmark className="h-5 w-5" />, note: "Fitur anak tetap terpisah." },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-card">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fff0f6] text-[#ef5b93]">{item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-black">{item.label}</span>
            <span className="block truncate text-xs font-bold text-[#9b7d8a]">{item.note}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[#c6a8b5]" />
        </Link>
      ))}
    </div>
  );
}

function QuickFab({ pockets, setTab, setShopTab }: { pockets: { id: string; name: string }[]; setTab: (tab: MainTab) => void; setShopTab: (tab: ShopTab) => void }) {
  return (
    <ResponsiveSheet>
      <ResponsiveSheetTrigger asChild>
        <button className="safe-bottom fixed bottom-[84px] right-5 z-50 grid h-14 w-14 rounded-full bg-[#ef5b93] text-white shadow-card-deep transition active:scale-95 lg:right-[calc(50%-500px+24px)]" aria-label="Input transaksi cepat">
          <Plus className="m-auto h-7 w-7" />
        </button>
      </ResponsiveSheetTrigger>
      <ResponsiveSheetContent title="Input cepat" description="Pilih jenis catatan yang ingin dibuat.">
        <QuickActions pockets={pockets} setTab={setTab} setShopTab={setShopTab} />
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

function QuickActions({ pockets, setTab, setShopTab }: { pockets: { id: string; name: string }[]; setTab: (tab: MainTab) => void; setShopTab: (tab: ShopTab) => void }) {
  return (
    <div className="grid gap-2">
      <IncomeFormSheet
        pockets={pockets}
        trigger={<QuickButton icon={<Plus className="h-5 w-5" />} title="Pendapatan" text="Tambah pemasukan" />}
      />
      <QuickButton icon={<ShoppingBag className="h-5 w-5" />} title="Pengeluaran" text="Catat belanja manual" onClick={() => { setTab("belanja"); setShopTab("manual"); }} />
      <QuickButton icon={<ArrowRightLeft className="h-5 w-5" />} title="Transfer" text="Pindah saldo antar pocket" onClick={() => setTab("dompet")} />
      <QuickButton icon={<Camera className="h-5 w-5" />} title="Belanja" text="Rencana, checklist, manual, atau scan" onClick={() => { setTab("belanja"); setShopTab("scan"); }} />
    </div>
  );
}

function QuickButton({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-[#fff7fa] p-3 text-left transition active:scale-[0.99]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ef5b93] text-white">{icon}</span>
      <span className="min-w-0">
        <span className="block font-black">{title}</span>
        <span className="block text-xs font-bold text-[#9b7d8a]">{text}</span>
      </span>
    </button>
  );
}

function SavingsPreview({ summary }: { summary: FinanceSummary | null }) {
  return (
    <Card className="p-4">
      <SectionTitle icon={<PiggyBank className="h-5 w-5" />} title="Saving Goals" />
      <div className="mt-3 space-y-2">
        {(summary?.pockets ?? []).slice(0, 3).map((pocket) => (
          <div key={pocket.id} className="rounded-2xl bg-[#fff7fa] p-3">
            <p className="font-black">{pocket.name}</p>
            <p className="tabular text-sm font-bold text-[#ef5b93]">{formatRupiah(pocket.balance)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-heading text-base font-black text-[#473640]">
      <span className="text-[#ef5b93]">{icon}</span>
      {title}
    </h2>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-[24px] bg-white shadow-[0_10px_26px_rgba(120,55,82,0.10)]", className)}>{children}</section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] bg-[#fff7fa] px-5 py-8 text-center">
      <img src="/assets/illustrations/empty-state.svg" alt="" className="mx-auto h-28 w-28" />
      <p className="mt-2 font-heading text-base font-black text-[#473640]">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs font-bold text-[#9b7d8a]">{text}</p>
    </div>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const positive = entry.kind === "income";
  const color = positive ? "text-[#3ca85f]" : entry.kind === "transfer" ? "text-[#7c6bd8]" : "text-[#f05a64]";
  const icon = entry.kind === "income" ? <Plus className="h-4 w-4" /> : entry.kind === "transfer" ? <ArrowRightLeft className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff0f6] text-[#ef5b93]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{entry.title}</p>
        <p className="truncate text-xs font-bold text-[#9b7d8a]">{entry.account}{entry.categoryLabel ? ` - ${entry.categoryLabel}` : ""} - {entry.createdByName}</p>
      </div>
      <p className={cn("tabular shrink-0 text-sm font-black", color)}>{positive ? "+" : entry.kind === "expense" ? "-" : ""}{formatRupiah(entry.amount)}</p>
    </div>
  );
}

function MiniBalance({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/18 p-3">
      <p className="text-[10px] font-black uppercase text-white/75">{label}</p>
      <p className="tabular mt-1 truncate font-mono text-sm font-black">{formatRupiah(value)}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff7fa] p-3">
      <p className="text-[10px] font-black uppercase text-[#9b7d8a]">{label}</p>
      <p className="tabular mt-1 truncate font-black text-[#473640]">{value}</p>
    </div>
  );
}

function AnalyticsBar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div className="flex h-52 flex-col justify-end rounded-2xl bg-[#fff7fa] p-3">
      <div className={cn("mx-auto w-12 rounded-t-2xl", className)} style={{ height: `${Math.max(6, (value / max) * 150)}px` }} />
      <p className="mt-3 text-center text-xs font-black">{label}</p>
      <p className="tabular text-center text-xs font-bold text-[#9b7d8a]">{formatRupiah(value)}</p>
    </div>
  );
}

function CalendarPill({ value, positive = false }: { value: number; positive?: boolean }) {
  return (
    <span className={cn("block truncate rounded px-1 py-0.5 text-[9px] font-black text-white", positive ? "bg-[#45a867]" : "bg-[#f05a64]")}>
      {positive ? "+" : "-"}{compactRupiah(value)}
    </span>
  );
}

function groupByDate(entries: LedgerEntry[]) {
  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

function buildCalendar(month: string, entries: LedgerEntry[]) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const buckets = new Map<string, { income: number; expense: number }>();
  for (const entry of entries) {
    const current = buckets.get(entry.date) ?? { income: 0, expense: 0 };
    if (entry.kind === "income") current.income += entry.amount;
    if (entry.kind === "expense") current.expense += entry.amount;
    buckets.set(entry.date, current);
  }

  const days: { date: string; day: number | null; income: number; expense: number }[] = [];
  for (let index = 0; index < first.getDay(); index++) days.push({ date: `blank-${index}`, day: null, income: 0, expense: 0 });
  for (let day = 1; day <= totalDays; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const total = buckets.get(date) ?? { income: 0, expense: 0 };
    days.push({ date, day, ...total });
  }
  while (days.length % 7 !== 0) days.push({ date: `blank-end-${days.length}`, day: null, income: 0, expense: 0 });
  return days;
}

function compactRupiah(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}jt`;
  if (value >= 1000) return `${Math.round(value / 1000)}rb`;
  return String(Math.round(value));
}
