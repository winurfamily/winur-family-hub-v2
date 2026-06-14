"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { pocketSchema, type PocketInput } from "@/lib/validation/keuangan";
import { createPocket, updatePocket } from "@/app/actions/keuangan";

interface PocketDialogProps {
  pocket?: { id: string; name: string; splitPercent: number };
  trigger: React.ReactNode;
}

export function PocketDialog({ pocket, trigger }: PocketDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!pocket;

  const form = useForm<z.input<typeof pocketSchema>, unknown, PocketInput>({
    resolver: zodResolver(pocketSchema),
    defaultValues: { name: pocket?.name ?? "", splitPercent: pocket?.splitPercent ?? 0 },
  });

  const onSubmit = (values: PocketInput) => {
    startTransition(async () => {
      const result = isEdit ? await updatePocket({ id: pocket!.id, ...values }) : await createPocket(values);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan pocket.");
        return;
      }

      toast.success(isEdit ? "Pocket diperbarui." : "Pocket ditambahkan.");
      if (!isEdit) form.reset({ name: "", splitPercent: 0 });
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset({ name: pocket?.name ?? "", splitPercent: pocket?.splitPercent ?? 0 });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl border-2 border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-ink-1">{isEdit ? "✏️ Edit Pocket" : "➕ Tambah Pocket"}</DialogTitle>
          <DialogDescription>Atur nama & persentase split dari pendapatan (total semua pocket maks 100%).</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Pocket</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Dana Darurat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="splitPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split dari Pendapatan (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step={1} {...field} value={field.value as number} />
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
