"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { transferSchema, type TransferInput, MAIN_POCKET_VALUE } from "@/lib/validation/keuangan";
import { transferPocket, type PocketSummary } from "@/app/actions/keuangan";

export function TransferForm({ pockets }: { pockets: PocketSummary[] }) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.input<typeof transferSchema>, unknown, TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromType: "main", fromPocketId: "", toPocketId: "", amount: 0, note: "" },
  });

  const fromType = form.watch("fromType");

  const onSubmit = (values: TransferInput) => {
    startTransition(async () => {
      const result = await transferPocket({
        fromType: values.fromType,
        fromPocketId: values.fromType === "pocket" ? values.fromPocketId : undefined,
        toPocketId: values.toPocketId,
        amount: values.amount,
        note: values.note,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal melakukan transfer.");
        return;
      }

      toast.success("Transfer berhasil.");
      form.reset({ fromType: "main", fromPocketId: "", toPocketId: "", amount: 0, note: "" });
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3 rounded-2xl border-2 border-border bg-card shadow-card p-4"
      >
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-accent" /> Transfer Antar Pocket
        </h2>

        <FormField
          control={form.control}
          name="fromType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dari</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("fromPocketId", "");
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={MAIN_POCKET_VALUE}>Saldo Utama</SelectItem>
                  <SelectItem value="pocket">Pocket</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {fromType === "pocket" && (
          <FormField
            control={form.control}
            name="fromPocketId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pocket Asal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih pocket asal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pockets.map((pocket) => (
                      <SelectItem key={pocket.id} value={pocket.id}>
                        {pocket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="toPocketId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ke Pocket</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pocket tujuan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {pockets.map((pocket) => (
                    <SelectItem key={pocket.id} value={pocket.id}>
                      {pocket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <GameButton type="submit" variant="secondary" block disabled={isPending}>
          {isPending ? "Memproses..." : "Transfer"}
        </GameButton>
      </form>
    </Form>
  );
}
