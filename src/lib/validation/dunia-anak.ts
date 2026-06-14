import { z } from "zod";

export const tugasQuestionSchema = z.object({
  question: z.string().min(3, "Pertanyaan wajib diisi"),
  options: z.tuple([
    z.string().min(1, "Wajib diisi"),
    z.string().min(1, "Wajib diisi"),
    z.string().min(1, "Wajib diisi"),
    z.string().min(1, "Wajib diisi"),
  ]),
  correct_answer: z.coerce.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
});
export type TugasQuestionInput = z.infer<typeof tugasQuestionSchema>;

export const publishTaskSchema = z.object({
  childId: z.string().min(1),
  type: z.enum(["task", "tugas"]),
  title: z.string().min(2, "Judul minimal 2 karakter").max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
  rewardMoney: z.coerce.number().min(0),
  rewardPoint: z.coerce.number().int().min(0),
  rewardXp: z.coerce.number().int().min(0),
  questions: z.array(tugasQuestionSchema).optional(),
});
export type PublishTaskInput = z.infer<typeof publishTaskSchema>;

export const pointRewardSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(60),
  description: z.string().max(200).optional(),
  imageUrl: z.string().optional(),
  pointCost: z.coerce.number().int().min(0, "Minimal 0 point"),
  minPointUnlock: z.coerce.number().int().min(0, "Minimal 0 point"),
});
export type PointRewardInput = z.infer<typeof pointRewardSchema>;

export const investReturnSchema = z.object({
  returnPercent: z.coerce.number().min(0, "Minimal 0%").max(100, "Maksimal 100%"),
});
export type InvestReturnInput = z.infer<typeof investReturnSchema>;

export const familySettingsSchema = z.object({
  defaultTaskMoney: z.coerce.number().min(0),
  defaultTaskPoint: z.coerce.number().int().min(0),
  defaultTaskXp: z.coerce.number().int().min(0),
  defaultTugasMoney: z.coerce.number().min(0),
  defaultTugasPoint: z.coerce.number().int().min(0),
  defaultTugasXp: z.coerce.number().int().min(0),
  streakBonusMoney: z.coerce.number().min(0),
  streakBonusPoint: z.coerce.number().int().min(0),
  soundEnabled: z.boolean(),
  theme: z.string().min(1),
});
export type FamilySettingsInput = z.infer<typeof familySettingsSchema>;

export const childProfileSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(40),
  age: z.coerce.number().int().min(1, "Usia minimal 1 tahun").max(18, "Usia maksimal 18 tahun"),
  worldTheme: z.string().min(1),
});
export type ChildProfileInput = z.infer<typeof childProfileSchema>;

export const avatarSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(60),
  costume: z.string().max(100).optional(),
  imageUrl: z.string().min(1, "Generate gambar dulu"),
  unlockLevel: z.coerce.number().int().min(1, "Minimal level 1"),
});
export type AvatarInput = z.infer<typeof avatarSchema>;

export const petSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(60),
  style: z.string().max(300).optional(),
  imageUrl: z.string().min(1, "Generate gambar dulu"),
  unlockLevel: z.coerce.number().int().min(1, "Minimal level 1"),
});
export type PetInput = z.infer<typeof petSchema>;

export const childBackgroundSchema = z.object({
  description: z.string().min(3, "Deskripsi minimal 3 karakter").max(300),
});
export type ChildBackgroundInput = z.infer<typeof childBackgroundSchema>;

export const childPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN harus 4 digit angka"),
  pinConfirm: z.string().regex(/^\d{4}$/, "PIN harus 4 digit angka"),
}).refine((data) => data.pin === data.pinConfirm, {
  message: "Konfirmasi PIN tidak cocok",
  path: ["pinConfirm"],
});
export type ChildPinInput = z.infer<typeof childPinSchema>;
