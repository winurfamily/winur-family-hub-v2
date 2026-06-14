import { z } from "zod";

export const adminPinSchema = z
  .string()
  .regex(/^\d{6}$/, "PIN admin harus 6 digit angka");

export const childPinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN anak harus 4 digit angka");

export const setupFamilySchema = z.object({
  familyName: z.string().min(2, "Nama keluarga minimal 2 karakter").max(40),
});

const adminBaseSchema = z.object({
  ayahName: z.string().min(2, "Nama minimal 2 karakter").max(30),
  mamahName: z.string().min(2, "Nama minimal 2 karakter").max(30),
  adminPin: adminPinSchema,
  adminPinConfirm: adminPinSchema,
});

export const setupAdminSchema = adminBaseSchema.refine(
  (data) => data.adminPin === data.adminPinConfirm,
  { message: "Konfirmasi PIN tidak sama", path: ["adminPinConfirm"] }
);

export const setupChildSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(30),
  age: z.coerce.number().int().min(1, "Usia minimal 1 tahun").max(18, "Usia maksimal 18 tahun"),
  pin: childPinSchema,
});

export const setupChildrenSchema = z.object({
  children: z.array(setupChildSchema).min(1, "Minimal 1 anak"),
});

export const completeSetupSchema = z.object({
  familyName: setupFamilySchema.shape.familyName,
  ayahName: adminBaseSchema.shape.ayahName,
  mamahName: adminBaseSchema.shape.mamahName,
  adminPin: adminPinSchema,
  children: z.array(setupChildSchema).min(1).max(4),
});

export type CompleteSetupInput = z.infer<typeof completeSetupSchema>;
export type SetupChildInput = z.infer<typeof setupChildSchema>;

/**
 * Skema untuk form wizard (termasuk field konfirmasi PIN yang
 * tidak dikirim ke server, hanya untuk validasi UI).
 */
export const setupWizardChildSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(30),
    age: z.coerce.number().int().min(1, "Usia minimal 1 tahun").max(18, "Usia maksimal 18 tahun"),
    pin: childPinSchema,
    pinConfirm: childPinSchema,
  })
  .refine((data) => data.pin === data.pinConfirm, {
    message: "Konfirmasi PIN tidak sama",
    path: ["pinConfirm"],
  });

export const setupWizardSchema = z
  .object({
    familyName: setupFamilySchema.shape.familyName,
    ayahName: adminBaseSchema.shape.ayahName,
    mamahName: adminBaseSchema.shape.mamahName,
    adminPin: adminPinSchema,
    adminPinConfirm: adminPinSchema,
    children: z.array(setupWizardChildSchema).min(1, "Minimal 1 anak").max(4, "Maksimal 4 anak"),
  })
  .refine((data) => data.adminPin === data.adminPinConfirm, {
    message: "Konfirmasi PIN tidak sama",
    path: ["adminPinConfirm"],
  });

export type SetupWizardInput = z.infer<typeof setupWizardSchema>;
export type SetupWizardChildInput = z.infer<typeof setupWizardChildSchema>;
