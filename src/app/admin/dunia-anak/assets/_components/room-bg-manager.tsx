"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2, Upload, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminSetActiveTheme,
  createRoomTheme,
  deleteRoomTheme,
  updateRoomThemeUnlockLevel,
  uploadRoomThemeImage,
  type ChildRoomThemes,
} from "@/app/actions/room-theme";

export function RoomBgManager({ childrenThemes }: { childrenThemes: ChildRoomThemes[] }) {
  if (childrenThemes.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada profil anak.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {childrenThemes.map((c) => (
        <ChildRoomCard key={c.childId} data={c} />
      ))}
    </div>
  );
}

function ChildRoomCard({ data }: { data: ChildRoomThemes }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [isSettingActive, startSetActive] = useTransition();

  const activeName =
    data.builtinThemes.find((b) => b.key === data.activeThemeKey)?.name ??
    data.customThemes.find((c) => c.id === data.activeThemeKey)?.name ??
    "Default";

  const setActive = (key: string) => {
    if (key === data.activeThemeKey) return;
    startSetActive(async () => {
      const res = await adminSetActiveTheme(data.childId, key);
      if (!res.success) {
        toast.error(res.error ?? "Gagal mengganti tema.");
        return;
      }
      toast.success("Tema kamar diganti.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading font-extrabold text-ink-1 truncate">{data.childName}</p>
          <p className="text-xs text-ink-3">
            Tema aktif: <span className="font-bold text-ink-2">{activeName}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-accent">
          {data.kind}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.builtinThemes.map((b) => (
          <ThemeThumb
            key={b.key}
            img={b.dayImage}
            name={b.name}
            badge="Bawaan"
            active={b.key === data.activeThemeKey}
            disabled={isSettingActive}
            onUse={() => setActive(b.key)}
          />
        ))}
        {data.customThemes.map((c) => (
          <ThemeThumb
            key={c.id}
            img={c.dayImageUrl}
            name={c.name}
            badge="Custom"
            active={c.id === data.activeThemeKey}
            disabled={isSettingActive}
            onUse={() => setActive(c.id)}
            themeId={c.id}
            unlockLevel={c.unlockLevel}
            onDeleted={() => router.refresh()}
          />
        ))}
      </div>

      {adding ? (
        <AddBackgroundForm
          childId={data.childId}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <GameButton type="button" variant="accent" size="sm" block onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Tambah Background Kamar
        </GameButton>
      )}
    </div>
  );
}

function ThemeThumb({
  img,
  name,
  badge,
  active,
  disabled,
  onUse,
  themeId,
  unlockLevel,
  onDeleted,
}: {
  img: string;
  name: string;
  badge: string;
  active: boolean;
  disabled?: boolean;
  onUse: () => void;
  themeId?: string;
  unlockLevel?: number;
  onDeleted?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [level, setLevel] = useState(unlockLevel ?? 1);
  const [isSavingLevel, startSaveLevel] = useTransition();

  const handleDelete = () => {
    if (!themeId) return;
    startDelete(async () => {
      const res = await deleteRoomTheme(themeId);
      if (!res.success) {
        toast.error(res.error ?? "Gagal menghapus background.");
        setConfirmDelete(false);
        return;
      }
      toast.success("Background dihapus.");
      onDeleted?.();
    });
  };

  const handleSaveLevel = () => {
    if (!themeId) return;
    startSaveLevel(async () => {
      const res = await updateRoomThemeUnlockLevel(themeId, level);
      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan level unlock.");
        return;
      }
      toast.success("Level unlock disimpan.");
    });
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border-2 ${active ? "border-secondary" : "border-border"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={name} className="aspect-[4/3] w-full object-cover" />
      <div className="bg-card px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-bold text-ink-1">{name}</span>
          <span className="shrink-0 text-[9px] font-black text-ink-3">{badge}</span>
        </div>
        {active ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-secondary">
            <Check className="h-3 w-3" /> Aktif
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={onUse}
            className="mt-1 text-[10px] font-black text-accent disabled:opacity-50"
          >
            Pakai tema ini
          </button>
        )}
        {themeId && (
          <div className="mt-1.5 flex items-center gap-1 border-t border-border pt-1.5">
            <span className="text-[9px] font-bold text-ink-3">Unlock Lv.</span>
            <Input
              type="number"
              min={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) || 1)}
              className="h-6 w-12 px-1 text-center text-[10px]"
            />
            <button
              type="button"
              onClick={handleSaveLevel}
              disabled={isSavingLevel || level === unlockLevel}
              className="text-[9px] font-black text-accent disabled:opacity-40"
            >
              Simpan
            </button>
          </div>
        )}
      </div>

      {themeId &&
        (confirmDelete ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60">
            <GameButton type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(false)} disabled={isDeleting} playSound={false}>
              <X className="h-4 w-4" />
            </GameButton>
            <GameButton type="button" variant="primary" size="icon" onClick={handleDelete} disabled={isDeleting} playSound={false}>
              <Check className="h-4 w-4" />
            </GameButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow"
            aria-label="Hapus background"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        ))}
    </div>
  );
}

function AddBackgroundForm({ childId, onDone, onCancel }: { childId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [dayUrl, setDayUrl] = useState<string | null>(null);
  const [nightUrl, setNightUrl] = useState<string | null>(null);
  const [unlockLevel, setUnlockLevel] = useState(1);
  const [makeActive, setMakeActive] = useState(true);
  const [uploadingDay, startDay] = useTransition();
  const [uploadingNight, startNight] = useTransition();
  const [isSaving, startSave] = useTransition();
  const dayRef = useRef<HTMLInputElement>(null);
  const nightRef = useRef<HTMLInputElement>(null);

  const upload = (file: File, kind: "day" | "night") => {
    const run = kind === "day" ? startDay : startNight;
    run(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadRoomThemeImage(fd);
      if (!res.success || !res.imageUrl) {
        toast.error(res.error ?? "Gagal mengunggah gambar.");
        return;
      }
      if (kind === "day") setDayUrl(res.imageUrl);
      else setNightUrl(res.imageUrl);
    });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>, kind: "day" | "night") => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) upload(f, kind);
  };

  const save = () => {
    if (name.trim().length < 2) {
      toast.error("Nama tema minimal 2 karakter.");
      return;
    }
    if (!dayUrl) {
      toast.error("Upload gambar siang dulu.");
      return;
    }
    startSave(async () => {
      const res = await createRoomTheme({ childId, name: name.trim(), dayImageUrl: dayUrl, nightImageUrl: nightUrl, unlockLevel, setActive: makeActive });
      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan background.");
        return;
      }
      toast.success("Background kamar ditambahkan.");
      onDone();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-border bg-surface-2 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Nama Tema</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kamar Luar Angkasa" />
        </div>
        <div className="space-y-1">
          <Label>Unlock di Level</Label>
          <Input type="number" min={1} value={unlockLevel} onChange={(e) => setUnlockLevel(Number(e.target.value) || 1)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <UploadSlot label="Siang (wajib)" url={dayUrl} busy={uploadingDay} inputRef={dayRef} onPick={() => dayRef.current?.click()} onFile={(e) => onFile(e, "day")} />
        <UploadSlot label="Malam (opsional)" url={nightUrl} busy={uploadingNight} inputRef={nightRef} onPick={() => nightRef.current?.click()} onFile={(e) => onFile(e, "night")} />
      </div>

      <p className="text-[11px] leading-snug text-ink-3">
        Ikuti tata letak perabot kamar referensi (kasur kiri, jendela tengah, lemari &amp; meja kanan) supaya tombol/hotspot pas. Gambar otomatis dipotong ke 4:3.
        Jika malam dikosongkan, dipakai gambar siang.
      </p>

      <label className="flex items-center gap-2 text-xs font-bold text-ink-2">
        <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} className="h-4 w-4" /> Langsung jadikan tema aktif anak
      </label>

      <div className="flex gap-2">
        <GameButton type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          Batal
        </GameButton>
        <GameButton type="button" variant="secondary" size="sm" block onClick={save} disabled={isSaving || uploadingDay || uploadingNight}>
          {isSaving ? "Menyimpan..." : "Simpan Background"}
        </GameButton>
      </div>
    </div>
  );
}

function UploadSlot({
  label,
  url,
  busy,
  inputRef,
  onPick,
  onFile,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-card disabled:opacity-60"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] font-bold text-ink-3">
            <Upload className="h-4 w-4 text-secondary" /> {busy ? "Mengunggah..." : "Upload"}
          </span>
        )}
      </button>
    </div>
  );
}
