"use client";

/** Komponen bersama untuk isi sheet Dunia Anak (tema putih, slide-up). */

export function SheetHeader({ title, onClose, right }: { title: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-heading text-base font-black text-[#1C1E26]">{title}</h3>
      <div className="flex items-center gap-2">
        {right}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F6] font-black text-[#5A5F6E]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function SheetLoading() {
  return <div className="py-8 text-center text-sm font-bold text-[#9AA0AE]">Memuat…</div>;
}

export function SheetEmpty({ icon = "✨", text }: { icon?: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="mt-2 text-sm font-bold text-[#9AA0AE]">{text}</p>
    </div>
  );
}
