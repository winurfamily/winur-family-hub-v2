"use client";

import { useEffect } from "react";

/**
 * Menambahkan class `child-shell` ke <body> selama halaman Dunia Anak aktif,
 * supaya konten yang dirender lewat Portal (Dialog/Sheet) ikut mewarisi
 * tema dark navy "game world" — bukan cuma konten di dalam wrapper utama.
 */
export function ChildThemeScope() {
  useEffect(() => {
    document.body.classList.add("child-shell");
    return () => {
      document.body.classList.remove("child-shell");
    };
  }, []);

  return null;
}
