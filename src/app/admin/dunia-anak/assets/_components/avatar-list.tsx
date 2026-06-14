"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Star, Trash2, User, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { deleteAvatar, updateAvatarUnlockLevel, type AvatarItem } from "@/app/actions/anak-assets";

export function AvatarList({ avatars }: { avatars: AvatarItem[] }) {
  if (avatars.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada avatar di library.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {avatars.map((avatar) => (
        <AvatarRow key={avatar.id} avatar={avatar} />
      ))}
    </div>
  );
}

function AvatarRow({ avatar }: { avatar: AvatarItem }) {
  const router = useRouter();
  const [unlockLevel, setUnlockLevel] = useState(avatar.unlockLevel);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateAvatarUnlockLevel(avatar.id, unlockLevel);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan level unlock.");
        return;
      }
      toast.success("Level unlock disimpan.");
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteAvatar(avatar.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus avatar.");
        setConfirmDelete(false);
        return;
      }
      toast.success("Avatar dihapus.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
      <div className="flex items-start gap-3">
        {avatar.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.imageUrl} alt={avatar.name} className="w-14 h-14 rounded-xl object-cover border-2 border-border shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1 truncate">{avatar.name}</p>
          {avatar.costume && <p className="text-xs text-ink-2">{avatar.costume}</p>}
          {avatar.isDefault && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary mt-1">
              <Star className="w-3 h-3" /> Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <p className="text-xs text-ink-2">Hapus?</p>
              <GameButton type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(false)} disabled={isDeleting} playSound={false}>
                <X className="w-4 h-4" />
              </GameButton>
              <GameButton type="button" variant="primary" size="icon" onClick={handleDelete} disabled={isDeleting} playSound={false}>
                <Check className="w-4 h-4" />
              </GameButton>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-ink-3">Lv.</span>
                <Input
                  type="number"
                  min={1}
                  value={unlockLevel}
                  onChange={(e) => setUnlockLevel(Number(e.target.value) || 1)}
                  className="w-16 h-9 text-center"
                />
              </div>
              <GameButton type="button" variant="outline" size="sm" onClick={handleSave} disabled={isPending || unlockLevel === avatar.unlockLevel}>
                Simpan
              </GameButton>
              {!avatar.isDefault && (
                <GameButton type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </GameButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
