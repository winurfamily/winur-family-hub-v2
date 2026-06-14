"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, PawPrint, Trash2, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { deletePet, updatePetUnlockLevel, type PetItem } from "@/app/actions/anak-assets";

export function PetList({ pets }: { pets: PetItem[] }) {
  if (pets.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada pet di library.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pets.map((pet) => (
        <PetRow key={pet.id} pet={pet} />
      ))}
    </div>
  );
}

function PetRow({ pet }: { pet: PetItem }) {
  const router = useRouter();
  const [unlockLevel, setUnlockLevel] = useState(pet.unlockLevel);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePetUnlockLevel(pet.id, unlockLevel);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan level unlock.");
        return;
      }
      toast.success("Level unlock disimpan.");
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deletePet(pet.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus pet.");
        setConfirmDelete(false);
        return;
      }
      toast.success("Pet dihapus.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
      <div className="flex items-start gap-3">
        {pet.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.imageUrl} alt={pet.name} className="w-14 h-14 rounded-xl object-cover border-2 border-border shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-secondary-light flex items-center justify-center shrink-0">
            <PawPrint className="w-6 h-6 text-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1 truncate">{pet.name}</p>
          {pet.style && <p className="text-xs text-ink-2">{pet.style}</p>}
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
              <GameButton type="button" variant="outline" size="sm" onClick={handleSave} disabled={isPending || unlockLevel === pet.unlockLevel}>
                Simpan
              </GameButton>
              <GameButton type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </GameButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
