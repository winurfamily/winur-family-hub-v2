"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-sky-adventure px-4 text-center">
      <h2 className="text-lg font-semibold text-foreground">Terjadi kesalahan</h2>
      <p className="max-w-sm text-sm text-muted-foreground">Aplikasi gagal dimuat. Coba muat ulang halaman.</p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
