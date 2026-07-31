import { describe, it, expect } from "vitest";
import {
  currentMonth,
  monthRange,
  shiftMonth,
  lastMonths,
  resolvePeriod,
  isPeriodKey,
  normalizeProductName,
  sumBy,
} from "@/lib/finance";
import { formatRupiah, formatNumber } from "@/lib/format";
import { buildReceiptPath, pathBelongsToFamily, isReceiptMime } from "@/lib/server/receipts";

describe("format mata uang & angka Indonesia", () => {
  it("memformat rupiah dengan pemisah ribuan titik", () => {
    expect(formatRupiah(3010000)).toBe("Rp 3.010.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(1500)).toBe("Rp 1.500");
  });

  it("membulatkan pecahan agar nominal selalu rupiah bulat", () => {
    expect(formatRupiah(1999.6)).toBe("Rp 2.000");
    expect(formatRupiah(1999.4)).toBe("Rp 1.999");
  });

  it("memformat angka biasa dengan locale id-ID", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
  });
});

describe("rentang periode", () => {
  it("menghitung rentang bulan dengan benar termasuk Februari kabisat", () => {
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange("2025-02")).toEqual({ start: "2025-02-01", end: "2025-02-28" });
    expect(monthRange("2025-12")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });

  it("menggeser bulan melewati batas tahun", () => {
    expect(shiftMonth("2025-01", -1)).toBe("2024-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2025-06", -6)).toBe("2024-12");
  });

  it("menyusun enam bulan terakhir dari yang terlama", () => {
    expect(lastMonths(6, "2025-03")).toEqual([
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
      "2025-03",
    ]);
  });

  it("menyediakan periode pembanding sepanjang periode itu sendiri", () => {
    const p = resolvePeriod("3m", "2025-06");
    expect(p.months).toEqual(["2025-04", "2025-05", "2025-06"]);
    expect(p.start).toBe("2025-04-01");
    expect(p.end).toBe("2025-06-30");
    // Pembanding: tiga bulan tepat sebelumnya.
    expect(p.previous).toEqual({ start: "2025-01-01", end: "2025-03-31" });
  });

  it("membatasi tahun berjalan sampai bulan sekarang", () => {
    const p = resolvePeriod("ytd", "2025-04");
    expect(p.months).toEqual(["2025-01", "2025-02", "2025-03", "2025-04"]);
    expect(p.end).toBe("2025-04-30");
  });

  it("menolak kunci periode yang tidak dikenal", () => {
    expect(isPeriodKey("this_month")).toBe(true);
    expect(isPeriodKey("sepanjang_masa")).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
  });

  it("currentMonth mengembalikan format YYYY-MM", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("normalisasi produk (anti-duplikat)", () => {
  it("menyamakan nama dengan beda huruf besar dan spasi", () => {
    expect(normalizeProductName("  Beras   Premium 5KG ")).toBe("beras premium 5kg");
    expect(normalizeProductName("BERAS PREMIUM 5kg")).toBe(normalizeProductName("beras premium 5kg"));
  });
});

describe("sumBy", () => {
  it("menjumlahkan kolom dan aman terhadap data kosong", () => {
    expect(sumBy([{ total: 1000 }, { total: 2500 }], "total")).toBe(3500);
    expect(sumBy(null, "total")).toBe(0);
    expect(sumBy([], "total")).toBe(0);
  });
});

describe("keamanan path bukti struk", () => {
  const family = "11111111-1111-1111-1111-111111111111";

  it("menyusun path family_id/tahun/bulan/uuid.ext", () => {
    const path = buildReceiptPath(family, "image/webp", new Date(Date.UTC(2025, 6, 9)));
    expect(path).toMatch(
      new RegExp(`^${family}/2025/07/[0-9a-f-]{36}\\.webp$`)
    );
  });

  it("tidak pernah memakai nama berkas asli", () => {
    const a = buildReceiptPath(family, "image/jpeg");
    const b = buildReceiptPath(family, "image/jpeg");
    expect(a).not.toBe(b); // selalu UUID acak
    expect(a.endsWith(".jpg")).toBe(true);
  });

  it("menolak path milik keluarga lain dan upaya path traversal", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    expect(pathBelongsToFamily(`${family}/2025/07/a.webp`, family)).toBe(true);
    expect(pathBelongsToFamily(`${other}/2025/07/a.webp`, family)).toBe(false);
    expect(pathBelongsToFamily(`${family}/../${other}/a.webp`, family)).toBe(false);
  });

  it("hanya menerima tipe gambar yang diizinkan", () => {
    expect(isReceiptMime("image/webp")).toBe(true);
    expect(isReceiptMime("image/jpeg")).toBe(true);
    expect(isReceiptMime("image/png")).toBe(true);
    expect(isReceiptMime("image/gif")).toBe(false);
    expect(isReceiptMime("application/pdf")).toBe(false);
  });
});
