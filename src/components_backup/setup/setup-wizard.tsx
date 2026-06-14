"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Wallet, PiggyBank } from "lucide-react";
import type { z } from "zod";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupWizardSchema, type SetupWizardInput } from "@/lib/validation/setup";
import { completeSetup } from "@/app/actions/setup";
import { soundManager } from "@/lib/sound/sound-manager";

const STEP_LABELS = ["Selamat Datang", "Profil Admin", "Profil Anak", "Dompet", "Review"] as const;

type SetupWizardFormInput = z.input<typeof setupWizardSchema>;

const DEFAULT_VALUES: SetupWizardFormInput = {
  familyName: "",
  ayahName: "",
  mamahName: "",
  adminPin: "",
  adminPinConfirm: "",
  children: [{ name: "", age: 5, pin: "", pinConfirm: "" }],
};

const STEP_FIELDS: Path<SetupWizardFormInput>[][] = [
  ["familyName"],
  ["ayahName", "mamahName", "adminPin", "adminPinConfirm"],
  ["children"],
  [],
  [],
];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<SetupWizardFormInput, unknown, SetupWizardInput>({
    resolver: zodResolver(setupWizardSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
  });

  const {
    register,
    control,
    trigger,
    handleSubmit,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: "children" });

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (!valid) return;
    soundManager.play("tap");
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    soundManager.play("tap");
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = (data: SetupWizardInput) => {
    startTransition(async () => {
      const result = await completeSetup({
        familyName: data.familyName,
        ayahName: data.ayahName,
        mamahName: data.mamahName,
        adminPin: data.adminPin,
        children: data.children.map((c) => ({ name: c.name, age: c.age, pin: c.pin })),
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyelesaikan setup.");
        return;
      }

      soundManager.play("level_up");
      toast.success("Setup selesai! Selamat datang di Winur Family Hub 🎉");
      router.push("/");
      router.refresh();
    });
  };

  const values = form.watch();

  return (
    <div className="min-h-screen bg-sky-adventure flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-lg bg-card border-2 border-border rounded-3xl shadow-card p-6 sm:p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-2 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-ink-2 mb-4 uppercase tracking-wide">
          Langkah {step + 1}/{STEP_LABELS.length} &middot; {STEP_LABELS[step]}
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === 0 && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-accent-light flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-accent" />
                  </div>
                  <h1 className="font-heading font-extrabold text-2xl text-ink-1">
                    Selamat Datang di Winur Family Hub!
                  </h1>
                  <p className="text-sm text-ink-2">
                    Yuk siapkan keluarga kamu dulu. Proses ini cuma perlu beberapa menit.
                  </p>
                  <div className="text-left space-y-1.5">
                    <Label htmlFor="familyName">Nama Keluarga</Label>
                    <Input
                      id="familyName"
                      placeholder="Contoh: Keluarga Winur"
                      {...register("familyName")}
                    />
                    {errors.familyName && (
                      <p className="text-destructive text-xs font-bold">{errors.familyName.message}</p>
                    )}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-heading font-extrabold text-xl text-ink-1">Profil Admin (Ortu)</h2>
                  <p className="text-sm text-ink-2">
                    Ayah &amp; Mamah akan memakai PIN 6 digit yang sama untuk masuk.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="ayahName">Nama Ayah</Label>
                    <Input id="ayahName" placeholder="Ayah" {...register("ayahName")} />
                    {errors.ayahName && (
                      <p className="text-destructive text-xs font-bold">{errors.ayahName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mamahName">Nama Mamah</Label>
                    <Input id="mamahName" placeholder="Mamah" {...register("mamahName")} />
                    {errors.mamahName && (
                      <p className="text-destructive text-xs font-bold">{errors.mamahName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="adminPin">PIN Admin (6 digit)</Label>
                      <Input
                        id="adminPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••••"
                        {...register("adminPin")}
                      />
                      {errors.adminPin && (
                        <p className="text-destructive text-xs font-bold">{errors.adminPin.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adminPinConfirm">Konfirmasi PIN</Label>
                      <Input
                        id="adminPinConfirm"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••••"
                        {...register("adminPinConfirm")}
                      />
                      {errors.adminPinConfirm && (
                        <p className="text-destructive text-xs font-bold">
                          {errors.adminPinConfirm.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="font-heading font-extrabold text-xl text-ink-1">Profil Anak</h2>
                  <p className="text-sm text-ink-2">
                    Tambahkan profil untuk setiap anak. PIN anak 4 digit.
                  </p>

                  {errors.children?.root?.message && (
                    <p className="text-destructive text-xs font-bold">{errors.children.root.message}</p>
                  )}
                  {typeof errors.children?.message === "string" && (
                    <p className="text-destructive text-xs font-bold">{errors.children.message}</p>
                  )}

                  <div className="space-y-4">
                    {fields.map((field, index) => {
                      const childErrors = errors.children?.[index];
                      return (
                        <div
                          key={field.id}
                          className="border-2 border-border rounded-2xl p-4 space-y-3 bg-surface-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-heading font-bold text-ink-1">Anak {index + 1}</p>
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-destructive p-1"
                                aria-label="Hapus anak"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1.5">
                              <Label htmlFor={`children.${index}.name`}>Nama</Label>
                              <Input
                                id={`children.${index}.name`}
                                placeholder="Nama anak"
                                {...register(`children.${index}.name` as const)}
                              />
                              {childErrors?.name && (
                                <p className="text-destructive text-xs font-bold">
                                  {childErrors.name.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`children.${index}.age`}>Usia</Label>
                              <Input
                                id={`children.${index}.age`}
                                type="number"
                                min={1}
                                max={18}
                                {...register(`children.${index}.age` as const)}
                              />
                              {childErrors?.age && (
                                <p className="text-destructive text-xs font-bold">
                                  {childErrors.age.message}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`children.${index}.pin`}>PIN (4 digit)</Label>
                              <Input
                                id={`children.${index}.pin`}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="••••"
                                {...register(`children.${index}.pin` as const)}
                              />
                              {childErrors?.pin && (
                                <p className="text-destructive text-xs font-bold">
                                  {childErrors.pin.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`children.${index}.pinConfirm`}>Konfirmasi PIN</Label>
                              <Input
                                id={`children.${index}.pinConfirm`}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="••••"
                                {...register(`children.${index}.pinConfirm` as const)}
                              />
                              {childErrors?.pinConfirm && (
                                <p className="text-destructive text-xs font-bold">
                                  {childErrors.pinConfirm.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fields.length < 4 && (
                    <GameButton
                      type="button"
                      variant="outline"
                      size="sm"
                      block
                      onClick={() => append({ name: "", age: 5, pin: "", pinConfirm: "" })}
                    >
                      <Plus className="w-4 h-4" /> Tambah Anak
                    </GameButton>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="font-heading font-extrabold text-xl text-ink-1">Dompet Default</h2>
                  <p className="text-sm text-ink-2">
                    Dua dompet ini akan otomatis dibuat untuk keluarga kamu. Kamu bisa menambah
                    dompet lain nanti.
                  </p>

                  <div className="flex items-center gap-3 border-2 border-border rounded-2xl p-4 bg-surface-2">
                    <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-ink-1">Belanja</p>
                      <p className="text-xs text-ink-2">Dompet untuk kebutuhan sehari-hari</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-2 border-border rounded-2xl p-4 bg-surface-2">
                    <div className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center">
                      <PiggyBank className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-ink-1">Tabungan</p>
                      <p className="text-xs text-ink-2">Dompet untuk menabung jangka panjang</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="font-heading font-extrabold text-xl text-ink-1">Review</h2>
                  <p className="text-sm text-ink-2">
                    Pastikan data sudah benar sebelum menyelesaikan setup.
                  </p>

                  <div className="border-2 border-border rounded-2xl p-4 space-y-2 bg-surface-2 text-sm">
                    <p>
                      <span className="font-bold text-ink-1">Keluarga:</span> {values.familyName}
                    </p>
                    <p>
                      <span className="font-bold text-ink-1">Admin:</span> {values.ayahName} &amp;{" "}
                      {values.mamahName} (PIN {values.adminPin?.replace(/./g, "•")})
                    </p>
                    <div>
                      <span className="font-bold text-ink-1">Anak:</span>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {values.children?.map((c, i) => (
                          <li key={i}>
                            {c.name} ({String(c.age)} th) — PIN {c.pin?.replace(/./g, "•")}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-ink-2">Dompet: Belanja, Tabungan</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <GameButton type="button" variant="outline" onClick={goBack} disabled={isPending}>
                Kembali
              </GameButton>
            )}
            {step < STEP_LABELS.length - 1 ? (
              <GameButton type="button" variant="primary" block onClick={goNext}>
                Lanjut
              </GameButton>
            ) : (
              <GameButton type="submit" variant="secondary" block disabled={isPending}>
                {isPending ? "Menyimpan..." : "Selesaikan Setup"}
              </GameButton>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
