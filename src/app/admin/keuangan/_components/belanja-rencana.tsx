"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, Archive, Check, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  shoppingPlanSchema,
  type ShoppingPlanInput,
  planItemSchema,
  type PlanItemInput,
  MAIN_POCKET_VALUE,
} from "@/lib/validation/keuangan";
import {
  createShoppingPlan,
  addPlanItem,
  deletePlanItem,
  checkoutPlanItem,
  archivePlan,
  type PocketSummary,
  type ShoppingPlanWithItems,
  type ShoppingPlanItem,
} from "@/app/actions/keuangan";
import { formatRupiah, formatDate, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

function CreatePlanDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.input<typeof shoppingPlanSchema>, unknown, ShoppingPlanInput>({
    resolver: zodResolver(shoppingPlanSchema),
    defaultValues: { name: "", plannedDate: "" },
  });

  const onSubmit = (values: ShoppingPlanInput) => {
    startTransition(async () => {
      const result = await createShoppingPlan(values);
      if (!result.success) {
        toast.error(result.error ?? "Gagal membuat rencana.");
        return;
      }
      toast.success("Rencana belanja dibuat.");
      form.reset({ name: "", plannedDate: "" });
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <GameButton variant="primary" size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Rencana Baru
        </GameButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rencana Belanja Baru</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Rencana</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Belanja Bulanan Juni" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plannedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Rencana (opsional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <GameButton type="submit" variant="secondary" block disabled={isPending}>
              {isPending ? "Menyimpan..." : "Buat Rencana"}
            </GameButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddPlanItemForm({ planId }: { planId: string }) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.input<typeof planItemSchema>, unknown, PlanItemInput>({
    resolver: zodResolver(planItemSchema),
    defaultValues: { name: "", qty: 1, estimatedPrice: 0 },
  });

  const onSubmit = (values: PlanItemInput) => {
    startTransition(async () => {
      const result = await addPlanItem({ planId, ...values });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }
      form.reset({ name: "", qty: 1, estimatedPrice: 0 });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-[1fr_56px_96px_40px] gap-2 items-start">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Nama barang" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="qty"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="number" min={1} step={1} {...field} value={field.value as number} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estimatedPrice"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="number" min={0} step={500} placeholder="Estimasi" {...field} value={field.value as number} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <GameButton type="submit" variant="outline" size="icon" disabled={isPending} aria-label="Tambah barang">
          <Plus className="w-4 h-4" />
        </GameButton>
      </form>
    </Form>
  );
}

function CheckoutForm({
  item,
  pockets,
  onDone,
}: {
  item: ShoppingPlanItem;
  pockets: PocketSummary[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [actualPrice, setActualPrice] = useState(item.estimatedPrice);
  const [pocketId, setPocketId] = useState(MAIN_POCKET_VALUE);
  const [date, setDate] = useState(todayISODate());

  const handleCheckout = () => {
    startTransition(async () => {
      const result = await checkoutPlanItem({
        itemId: item.id,
        actualPrice,
        pocketId: pocketId === MAIN_POCKET_VALUE ? null : pocketId,
        date,
      });
      if (!result.success) {
        toast.error(result.error ?? "Gagal checkout item.");
        return;
      }
      toast.success("Item dibeli & dicatat.");
      onDone();
    });
  };

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border-2 border-border bg-muted/40 p-2">
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <label className="text-xs text-ink-3">Harga Aktual (Rp)</label>
        <Input
          type="number"
          min={0}
          step={500}
          value={actualPrice}
          onChange={(e) => setActualPrice(Number(e.target.value) || 0)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-ink-3">Sumber Dana</label>
        <Select value={pocketId} onValueChange={setPocketId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MAIN_POCKET_VALUE}>Saldo Utama</SelectItem>
            {pockets.map((pocket) => (
              <SelectItem key={pocket.id} value={pocket.id}>
                {pocket.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-ink-3">Tanggal</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="col-span-2 flex gap-2">
        <GameButton type="button" variant="secondary" size="sm" block disabled={isPending} onClick={handleCheckout}>
          <Check className="w-4 h-4" /> {isPending ? "Memproses..." : "Sudah Dibeli"}
        </GameButton>
        <GameButton type="button" variant="outline" size="sm" onClick={onDone} disabled={isPending}>
          <X className="w-4 h-4" />
        </GameButton>
      </div>
    </div>
  );
}

function PlanItemRow({ item, pockets }: { item: ShoppingPlanItem; pockets: PocketSummary[] }) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePlanItem(item.id);
      if (!result.success) toast.error(result.error ?? "Gagal menghapus item.");
    });
  };

  if (item.checked) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm py-1">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="w-4 h-4 text-secondary shrink-0" />
          <span className="text-ink-3 line-through truncate">
            {item.name} x{item.qty}
          </span>
        </div>
        <span className="text-ink-3 shrink-0">{formatRupiah((item.actualPrice ?? 0) * item.qty)}</span>
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 text-left"
          onClick={() => setIsCheckingOut((v) => !v)}
        >
          <span className="w-4 h-4 rounded border-2 border-border shrink-0" />
          <span className="text-ink-1 truncate">
            {item.name} x{item.qty}
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-ink-3">{formatRupiah(item.estimatedPrice * item.qty)}</span>
          <button type="button" onClick={handleDelete} disabled={isPending} aria-label="Hapus item">
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>
      {isCheckingOut && (
        <CheckoutForm item={item} pockets={pockets} onDone={() => setIsCheckingOut(false)} />
      )}
    </div>
  );
}

function PlanCard({ plan, pockets }: { plan: ShoppingPlanWithItems; pockets: PocketSummary[] }) {
  const [isPending, startTransition] = useTransition();
  const allChecked = plan.items.length > 0 && plan.items.every((i) => i.checked);

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archivePlan(plan.id);
      if (!result.success) toast.error(result.error ?? "Gagal mengarsipkan rencana.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-extrabold text-ink-1">{plan.name}</h3>
          {plan.plannedDate && <p className="text-xs text-ink-3">{formatDate(plan.plannedDate)}</p>}
        </div>
        <Badge className={cn(plan.status === "done" ? "bg-secondary text-secondary-foreground" : "bg-muted text-ink-2")}>
          {plan.status === "done" ? "Selesai" : "Berjalan"}
        </Badge>
      </div>

      <div className="space-y-1 divide-y divide-border">
        {plan.items.map((item) => (
          <PlanItemRow key={item.id} item={item} pockets={pockets} />
        ))}
        {plan.items.length === 0 && <p className="text-sm text-ink-3 py-2">Belum ada barang.</p>}
      </div>

      <AddPlanItemForm planId={plan.id} />

      <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
        <span className="text-ink-2">
          Estimasi: <span className="font-bold text-ink-1">{formatRupiah(plan.totalEstimated)}</span>
        </span>
        <span className="text-ink-2">
          Aktual: <span className="font-bold text-ink-1">{formatRupiah(plan.totalActual)}</span>
        </span>
      </div>

      {allChecked && (
        <GameButton type="button" variant="outline" size="sm" block onClick={handleArchive} disabled={isPending}>
          <Archive className="w-4 h-4" /> Arsipkan Rencana
        </GameButton>
      )}
    </div>
  );
}

export function BelanjaRencana({
  plans,
  pockets,
}: {
  plans: ShoppingPlanWithItems[];
  pockets: PocketSummary[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" /> Rencana Belanja
        </h2>
        <CreatePlanDialog />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
          Belum ada rencana belanja.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} pockets={pockets} />
          ))}
        </div>
      )}
    </div>
  );
}
