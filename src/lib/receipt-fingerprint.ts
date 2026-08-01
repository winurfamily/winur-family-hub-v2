import { createHash } from "node:crypto";

/**
 * Sidik jari struk — kunci idempotensi impor.
 *
 * Dipisahkan dari server action-nya karena berkas `"use server"` hanya boleh
 * mengekspor fungsi async; fungsi murni seperti ini juga jauh lebih mudah
 * diuji sebagai modul tersendiri.
 *
 * Ada DUA sidik jari karena keduanya gagal pada kasus yang berbeda:
 *
 *  - `fingerprintDataUrl` membaca byte berkasnya. Unggahan PDF yang sama
 *    persis selalu menghasilkan hash yang sama, tetapi struk yang DIFOTO
 *    ULANG menghasilkan byte berbeda dan lolos.
 *  - `fingerprintReceiptData` membaca isi transaksinya (toko + tanggal +
 *    total). Itu menangkap foto ulang, tetapi tidak bisa dipakai sendirian
 *    karena dua belanja berbeda bisa saja kebetulan bertotal sama di hari
 *    yang sama.
 *
 * Dipakai bersama-sama, keduanya menutup lubang masing-masing.
 */

/** SHA-256 hex dari data URL base64 — dihitung dari byte berkas aslinya. */
export function fingerprintDataUrl(dataUrl: string): string {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
}

/** SHA-256 hex dari byte berkas yang sudah dibaca. */
export function fingerprintBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Sidik jari isi transaksi.
 *
 * Nama toko dinormalisasi (huruf kecil, tanpa spasi tepi) supaya "Lotte
 * Grosir" dan "LOTTE GROSIR " tidak dianggap dua struk berbeda.
 */
export function fingerprintReceiptData(merchant: string, date: string, total: number): string {
  return createHash("sha256")
    .update(`${merchant.trim().toLowerCase()}|${date}|${Math.round(total)}`)
    .digest("hex");
}

/** Bentuk sidik jari yang sah: 64 karakter heksadesimal huruf kecil. */
export function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
