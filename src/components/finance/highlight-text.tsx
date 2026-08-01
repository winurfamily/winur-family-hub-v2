"use client";

import { highlightParts } from "@/lib/search-query";
import { cn } from "@/lib/utils";

/**
 * Teks dengan bagian yang cocok pencarian disorot.
 *
 * Sorotan memakai latar kuning lembut, bukan huruf tebal: baris riwayat sudah
 * penuh teks tebal (nama, nominal), jadi menebalkan lagi tidak menonjol.
 * Warnanya sengaja tidak mengambil dari palet rose supaya tidak tertukar
 * dengan penanda "terpilih".
 *
 * Bila kata kuncinya kosong, komponen ini mengembalikan teks apa adanya tanpa
 * elemen tambahan — daftar tanpa pencarian tidak membayar apa pun.
 */
export function HighlightText({
  text,
  term,
  className,
}: {
  text: string;
  term: string;
  className?: string;
}) {
  if (!term.trim()) return <span className={className}>{text}</span>;

  const parts = highlightParts(text, term);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className={cn("rounded-[4px] bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-300/40")}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}
