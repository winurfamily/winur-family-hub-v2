"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPet, uploadPetImage } from "@/app/actions/anak-assets";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function CreatePetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [unlockLevel, setUnlockLevel] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isSaving, startSave] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setStyle("");
    setUnlockLevel(1);
    setImageUrl(null);
    setOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "image/png") {
      toast.error("Format gambar harus PNG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ukuran gambar maksimal 2MB.");
      return;
    }

    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const res = await uploadPetImage(formData);
      if (!res.success || !res.imageUrl) {
        toast.error(res.error ?? "Gagal mengunggah gambar.");
        return;
      }
      setImageUrl(res.imageUrl);
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Nama pet wajib diisi.");
      return;
    }
    if (!imageUrl) {
      toast.error("Upload gambar dulu.");
      return;
    }
    startSave(async () => {
      const res = await createPet({ name: name.trim(), style: style.trim() || undefined, imageUrl, unlockLevel });
      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan pet.");
        return;
      }
      toast.success("Pet berhasil ditambahkan.");
      reset();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <GameButton type="button" variant="accent" block onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Tambah Pet
      </GameButton>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1">Tambah Pet</h2>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="rounded-xl border-2 border-border w-full max-h-48 object-cover" />
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Nama Pet</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kucing Luar Angkasa" />
        </div>
        <div className="space-y-1">
          <Label>Gaya/Detail (opsional)</Label>
          <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Contoh: kucing oranye, mata besar" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Unlock di Level</Label>
        <Input type="number" min={1} value={unlockLevel} onChange={(e) => setUnlockLevel(Number(e.target.value) || 1)} />
      </div>

      <input ref={fileInputRef} type="file" accept="image/png" className="hidden" onChange={handleFileChange} />
      <GameButton type="button" variant="outline" block onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
        <Upload className="w-4 h-4 text-secondary" /> {isUploading ? "Mengunggah..." : "Upload Gambar (PNG, max 2MB, 512x512px)"}
      </GameButton>

      <div className="flex gap-2">
        <GameButton type="button" variant="outline" onClick={reset} disabled={isSaving}>
          Batal
        </GameButton>
        <GameButton type="button" variant="secondary" block onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Simpan Pet"}
        </GameButton>
      </div>
    </div>
  );
}
