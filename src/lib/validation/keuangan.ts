import { z } from "zod";

export const incomeSchema = z.object({
  source: z.string().min(2, "Sumber minimal 2 karakter").max(60),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().max(200).optional(),
});
export type IncomeInput = z.infer<typeof incomeSchema>;

export const pocketSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(40),
});
export type PocketInput = z.infer<typeof pocketSchema>;

export const transferSchema = z
  .object({
    fromType: z.enum(["main", "pocket"]),
    fromPocketId: z.string().optional(),
    toPocketId: z.string().min(1, "Pilih pocket tujuan"),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    note: z.string().max(200).optional(),
  })
  .refine((data) => data.fromType === "main" || !!data.fromPocketId, {
    message: "Pilih pocket asal",
    path: ["fromPocketId"],
  })
  .refine((data) => data.fromType === "main" || data.fromPocketId !== data.toPocketId, {
    message: "Pocket asal dan tujuan tidak boleh sama",
    path: ["toPocketId"],
  });
export type TransferInput = z.infer<typeof transferSchema>;

export const shoppingItemSchema = z.object({
  name: z.string().min(1, "Nama barang wajib diisi").max(80),
  qty: z.coerce.number().int("Qty harus bulat").positive("Qty minimal 1"),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  pocketId: z.string().optional(),
});
export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>;

export const shoppingPlanSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(60),
  plannedDate: z.string().optional(),
});
export type ShoppingPlanInput = z.infer<typeof shoppingPlanSchema>;

export const planItemSchema = z.object({
  name: z.string().min(1, "Nama barang wajib diisi").max(80),
  qty: z.coerce.number().int("Qty harus bulat").positive("Qty minimal 1"),
  estimatedPrice: z.coerce.number().min(0, "Estimasi tidak boleh negatif"),
});
export type PlanItemInput = z.infer<typeof planItemSchema>;

export const checkoutPlanItemSchema = z.object({
  actualPrice: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  pocketId: z.string().optional(),
  date: z.string().min(1, "Tanggal wajib diisi"),
});
export type CheckoutPlanItemInput = z.infer<typeof checkoutPlanItemSchema>;

/** Sentinel value untuk opsi "Saldo Utama" pada Select pocket (Radix Select tidak boleh value="") */
export const MAIN_POCKET_VALUE = "main";
