export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Tanggal hari ini dalam format "YYYY-MM-DD", selalu memakai waktu Indonesia
 * (WIB, UTC+7). Dipakai konsisten oleh client (browser) maupun server (Vercel,
 * UTC) agar "hari ini" untuk admin & anak selalu sama — sebelumnya memakai
 * getTimezoneOffset() yang berbeda antara browser (WIB) dan server (UTC),
 * menyebabkan task/tugas yang dipublikasikan "hari ini" tidak muncul di anak
 * saat dini hari WIB (00:00-06:59) karena tanggal UTC masih hari sebelumnya.
 */
export function todayISODate(): string {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
