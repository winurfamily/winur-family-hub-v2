"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, KeyRound, Sparkles, Trash2, Upload, User } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { updateChildProfile, setChildPin, type ChildSettingsItem } from "@/app/actions/anak-settings";
import { uploadChildPhoto, generateChildBackground, removeChildBackground } from "@/app/actions/anak-assets";
import { WORLD_THEMES } from "@/lib/constants";

export function ChildSettingsRow({ child }: { child: ChildSettingsItem }) {
  const [name, setName] = useState(child.name);
  const [age, setAge] = useState(child.age ?? 1);
  const [worldTheme, setWorldTheme] = useState(child.worldTheme);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [photoUrl, setPhotoUrl] = useState(child.photoUrl);
  const [backgroundUrl, setBackgroundUrl] = useState(child.backgroundUrl);
  const [backgroundDescription, setBackgroundDescription] = useState("");
  const [isSavingProfile, startSaveProfile] = useTransition();
  const [isSavingPin, startSavePin] = useTransition();
  const [isUploadingPhoto, startUploadPhoto] = useTransition();
  const [isGeneratingBackground, startGenerateBackground] = useTransition();
  const [isRemovingBackground, startRemoveBackground] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = () => {
    if (name.trim().length < 2) {
      toast.error("Nama minimal 2 karakter.");
      return;
    }
    startSaveProfile(async () => {
      const result = await updateChildProfile(child.id, { name: name.trim(), age, worldTheme });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan profil.");
        return;
      }
      toast.success("Profil anak disimpan.");
    });
  };

  const handleSavePin = () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN harus 4 digit angka.");
      return;
    }
    if (pin !== pinConfirm) {
      toast.error("Konfirmasi PIN tidak cocok.");
      return;
    }
    startSavePin(async () => {
      const result = await setChildPin(child.id, { pin, pinConfirm });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan PIN.");
        return;
      }
      toast.success("PIN anak diperbarui.");
      setPin("");
      setPinConfirm("");
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    startUploadPhoto(async () => {
      const formData = new FormData();
      formData.set("photo", file);
      const result = await uploadChildPhoto(child.id, formData);
      if (!result.success) {
        toast.error(result.error ?? "Gagal mengunggah foto.");
        return;
      }
      setPhotoUrl(URL.createObjectURL(file));
      toast.success("Foto profil diperbarui.");
    });
  };

  const handleGenerateBackground = () => {
    if (backgroundDescription.trim().length < 3) {
      toast.error("Isi deskripsi background dulu.");
      return;
    }
    startGenerateBackground(async () => {
      const result = await generateChildBackground(child.id, backgroundDescription.trim());
      if (!result.success || !result.imageUrl) {
        toast.error(result.error ?? "Gagal generate background.");
        return;
      }
      setBackgroundUrl(result.imageUrl);
      setBackgroundDescription("");
      toast.success("Background dunia anak diperbarui.");
    });
  };

  const handleRemoveBackground = () => {
    startRemoveBackground(async () => {
      const result = await removeChildBackground(child.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus background.");
        return;
      }
      setBackgroundUrl(null);
      toast.success("Background dunia anak dihapus.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <AvatarDisplay src={photoUrl} name={child.name} size={56} />
        <div className="flex-1">
          <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> {child.name}
          </h2>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="inline-flex items-center gap-1 text-xs font-bold text-secondary mt-1 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> {isUploadingPhoto ? "Mengunggah..." : "Ganti foto profil"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Usia</Label>
            <Input type="number" min={1} max={18} value={age} onChange={(e) => setAge(Number(e.target.value) || 1)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Tema Dunia</Label>
          <Select value={worldTheme} onValueChange={setWorldTheme}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORLD_THEMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <GameButton type="button" variant="secondary" size="sm" block onClick={handleSaveProfile} disabled={isSavingProfile}>
          {isSavingProfile ? "Menyimpan..." : "Simpan Profil"}
        </GameButton>
      </div>

      <div className="rounded-xl border-2 border-border p-3 space-y-2">
        <Label className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" /> Ubah PIN ({child.hasPin ? "sudah diatur" : "belum diatur"})
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN baru"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Konfirmasi PIN"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <GameButton type="button" variant="outline" size="sm" block onClick={handleSavePin} disabled={isSavingPin}>
          {isSavingPin ? "Menyimpan..." : "Simpan PIN"}
        </GameButton>
      </div>

      <div className="rounded-xl border-2 border-border p-3 space-y-2">
        <Label className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-accent" /> Background Dunia Anak (AI)
        </Label>

        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="Background dunia anak" className="rounded-xl border-2 border-border w-full aspect-video object-cover" />
        )}

        <Textarea
          placeholder="Deskripsikan background, contoh: taman luar angkasa dengan planet warna-warni dan bintang berkelip"
          value={backgroundDescription}
          onChange={(e) => setBackgroundDescription(e.target.value)}
          rows={2}
        />

        <div className="flex gap-2">
          <GameButton type="button" variant="outline" size="sm" block onClick={handleGenerateBackground} disabled={isGeneratingBackground}>
            <Sparkles className="w-4 h-4 text-accent" /> {isGeneratingBackground ? "Membuat background..." : "Generate Background"}
          </GameButton>
          {backgroundUrl && (
            <GameButton type="button" variant="outline" size="icon" onClick={handleRemoveBackground} disabled={isRemovingBackground}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
}
