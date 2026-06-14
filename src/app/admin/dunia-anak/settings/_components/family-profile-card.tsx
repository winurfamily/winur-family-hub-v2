"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { uploadProfilePhoto } from "@/app/actions/anak-assets";
import type { FamilyProfileItem } from "@/app/actions/anak-settings";

export function FamilyProfileCard({ profile }: { profile: FamilyProfileItem }) {
  const router = useRouter();
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const color = colorForName(profile.name);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    startUpload(async () => {
      const formData = new FormData();
      formData.set("photo", file);
      const result = await uploadProfilePhoto(profile.id, formData);
      if (!result.success) {
        toast.error(result.error ?? "Gagal mengunggah foto.");
        return;
      }
      toast.success("Avatar profil diperbarui.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 flex items-center gap-3">
      <AvatarDisplay src={profile.photoUrl} name={profile.name} color={color} size={64} />
      <div className="flex-1 min-w-0">
        <p className="font-heading font-extrabold text-ink-1 truncate">{profile.name}</p>
        <span
          className="inline-block text-xs font-bold text-white px-2 py-0.5 rounded-full mt-0.5"
          style={{ backgroundColor: color }}
        >
          {profile.role === "child" ? `Anak • Lv.${profile.level}` : "Admin"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1 text-xs font-bold text-secondary mt-1.5 disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" /> {isUploading ? "Mengunggah..." : "Ganti Avatar"}
        </button>
      </div>
    </div>
  );
}
