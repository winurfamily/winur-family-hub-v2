"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold text-foreground">Terjadi kesalahan</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Halaman ini gagal dimuat. Coba muat ulang, atau periksa koneksi ke Supabase.
      </p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
