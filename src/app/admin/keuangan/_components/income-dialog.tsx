"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { incomeSchema, type IncomeInput } from "@/lib/validation/keuangan";
import { addIncome } from "@/app/actions/keuangan";
import { todayISODate } from "@/lib/format";

export function IncomeDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.input<typeof incomeSchema>, unknown, IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { source: "", amount: 0, date: todayISODate(), note: "" },
  });

  const onSubmit = (values: IncomeInput) => {
    startTransition(async () => {
      const result = await addIncome(values);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan pendapatan.");
        return;
      }
      toast.success("Pendapatan berhasil dicatat & di-split ke pocket.");
      form.reset({ source: "", amount: 0, date: todayISODate(), note: "" });
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <GameButton variant="primary" size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Tambah Pendapatan
        </GameButton>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-2 border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-ink-1">💰 Tambah Pendapatan</DialogTitle>
          <DialogDescription>Pendapatan akan otomatis di-split ke pocket sesuai persentase.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sumber</FormLabel>
                  <FormControl>
                    <Input placeholder="Gaji, Bonus, dll" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal (Rp)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={1000} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Catatan tambahan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <GameButton type="submit" variant="secondary" block disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </GameButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
