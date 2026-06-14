"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPointReward, generateRewardImage } from "@/app/actions/anak-pointshop";

export function CreateRewardForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState(0);
  const [minPointUnlock, setMinPointUnlock] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();
  const [isSaving, startSave] = useTransition();

  const reset = () => {
    setName("");
    setDescription("");
    setPointCost(0);
    setMinPointUnlock(0);
    setImageUrl(null);
    setOpen(false);
  };

  const handleGenerateImage = () => {
    if (!name.trim()) {
      toast.error("Isi nama hadiah dulu.");
      return;
    }
    startGenerate(async () => {
      const res = await generateRewardImage(name, description);
      if (!res.success || !res.imageUrl) {
        toast.error(res.error ?? "Gagal generate gambar.");
        return;
      }
      setImageUrl(res.imageUrl);
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Nama hadiah wajib diisi.");
      return;
    }
    startSave(async () => {
      const res = await createPointReward({
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl ?? undefined,
        pointCost,
        minPointUnlock,
      });
      if (!res.success) {
        toast.error(res.error ?? "Gagal menambahkan hadiah.");
        return;
      }
      toast.success("Hadiah berhasil ditambahkan.");
      reset();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <GameButton type="button" variant="accent" block onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Tambah Hadiah
      </GameButton>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1">Tambah Hadiah</h2>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="rounded-xl border-2 border-border w-full max-h-40 object-cover" />
      )}

      <div className="space-y-1">
        <Label>Nama Hadiah</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Voucher Es Krim" />
      </div>

      <div className="space-y-1">
        <Label>Deskripsi</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Harga (point)</Label>
          <Input type="number" min={0} value={pointCost} onChange={(e) => setPointCost(Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Min. point unlock</Label>
          <Input
            type="number"
            min={0}
            value={minPointUnlock}
            onChange={(e) => setMinPointUnlock(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <GameButton type="button" variant="outline" block onClick={handleGenerateImage} disabled={isGenerating}>
        <Sparkles className="w-4 h-4 text-accent" /> {isGenerating ? "Membuat gambar..." : "Generate Gambar AI"}
      </GameButton>

      <div className="flex gap-2">
        <GameButton type="button" variant="outline" onClick={reset} disabled={isSaving}>
          Batal
        </GameButton>
        <GameButton type="button" variant="secondary" block onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Simpan Hadiah"}
        </GameButton>
      </div>
    </div>
  );
}
