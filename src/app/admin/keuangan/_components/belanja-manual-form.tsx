"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { shoppingItemSchema, type ShoppingItemInput, MAIN_POCKET_VALUE } from "@/lib/validation/keuangan";
import { addShoppingTransaction, searchProducts, type PocketSummary, type ProductSuggestion } from "@/app/actions/keuangan";
import { formatRupiah, todayISODate } from "@/lib/format";

export function BelanjaManualForm({ pockets }: { pockets: PocketSummary[] }) {
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);

  const form = useForm<z.input<typeof shoppingItemSchema>, unknown, ShoppingItemInput>({
    resolver: zodResolver(shoppingItemSchema),
    defaultValues: { name: "", qty: 1, price: 0, date: todayISODate(), pocketId: MAIN_POCKET_VALUE },
  });

  const nameValue = form.watch("name");
  const qtyValue = Number(form.watch("qty")) || 0;
  const priceValue = Number(form.watch("price")) || 0;

  useEffect(() => {
    if (nameValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchProducts(nameValue).then(setSuggestions);
    }, 300);
    return () => clearTimeout(timeout);
  }, [nameValue]);

  const pickSuggestion = (suggestion: ProductSuggestion) => {
    form.setValue("name", suggestion.name);
    form.setValue("price", suggestion.lastPrice);
    setSuggestions([]);
  };

  const onSubmit = (values: ShoppingItemInput) => {
    startTransition(async () => {
      const result = await addShoppingTransaction({
        name: values.name,
        qty: values.qty,
        price: values.price,
        date: values.date,
        pocketId: values.pocketId && values.pocketId !== MAIN_POCKET_VALUE ? values.pocketId : null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan transaksi belanja.");
        return;
      }

      toast.success("Belanja berhasil dicatat.");
      form.reset({ name: "", qty: 1, price: 0, date: values.date, pocketId: values.pocketId });
      setSuggestions([]);
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3 rounded-2xl border-2 border-border bg-card shadow-card p-4"
      >
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" /> Belanja Manual
        </h2>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="relative">
              <FormLabel>Nama Barang</FormLabel>
              <FormControl>
                <Input placeholder="Mis. Beras 5kg" autoComplete="off" {...field} />
              </FormControl>
              {suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border-2 border-border bg-card shadow-card overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted"
                    >
                      <span className="text-ink-1">{s.name}</span>
                      <span className="text-ink-3 text-xs">{formatRupiah(s.lastPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="qty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qty</FormLabel>
                <FormControl>
                  <Input type="number" min={1} step={1} {...field} value={field.value as number} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Harga Satuan (Rp)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={500} {...field} value={field.value as number} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-sm text-ink-2">
          Total: <span className="font-heading font-extrabold text-ink-1">{formatRupiah(qtyValue * priceValue)}</span>
        </p>

        <FormField
          control={form.control}
          name="pocketId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sumber Dana</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={MAIN_POCKET_VALUE}>Saldo Utama</SelectItem>
                  {pockets.map((pocket) => (
                    <SelectItem key={pocket.id} value={pocket.id}>
                      {pocket.name} ({formatRupiah(pocket.balance)})
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

        <GameButton type="submit" variant="secondary" block disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan Belanja"}
        </GameButton>
      </form>
    </Form>
  );
}
