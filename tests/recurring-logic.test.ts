import { describe, it, expect } from "vitest";
import {
  nextRecurringDate,
  dueDatesUntil,
  daysBetween,
  dueLabel,
  shiftDate,
  isIsoDate,
  isRecurringFrequency,
  RECURRING_LEAD_DAYS,
} from "@/lib/recurring";

/**
 * Aritmetika jadwal rutin.
 *
 * Fungsi-fungsi ini adalah kembaran TypeScript dari `fin_recurring_next_date`
 * di migration 0025. UI memakai versi ini untuk pratinjau "jatuh tempo
 * berikutnya", sedangkan generator memakai versi SQL untuk yang sungguhan —
 * jadi perbedaan sekecil apa pun akan membuat layar berbohong.
 */

describe("tanggal jatuh tempo berikutnya", () => {
  it("menambah tepat tujuh hari untuk jadwal mingguan", () => {
    expect(nextRecurringDate("2026-08-01", "weekly")).toBe("2026-08-08");
    expect(nextRecurringDate("2026-08-28", "weekly")).toBe("2026-09-04");
    expect(nextRecurringDate("2026-12-28", "weekly")).toBe("2027-01-04");
  });

  it("berpindah satu bulan dengan tanggal yang sama", () => {
    expect(nextRecurringDate("2026-08-05", "monthly")).toBe("2026-09-05");
    expect(nextRecurringDate("2026-12-05", "monthly")).toBe("2027-01-05");
  });

  it("menjepit tanggal 31 ke akhir bulan yang lebih pendek", () => {
    expect(nextRecurringDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRecurringDate("2024-01-31", "monthly")).toBe("2024-02-29");
    expect(nextRecurringDate("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  /**
   * Inti dari parameter `anchorDay`. Cicilan "tanggal 31 tiap bulan" yang
   * sekali terjepit ke 28 Februari harus KEMBALI ke 31 pada Maret. Tanpa
   * anchor, ia terkunci di tanggal 28 selamanya — dan jadwal cicilan
   * bergeser tiga hari untuk sisa umurnya.
   */
  it("kembali ke tanggal asli setelah melewati bulan pendek", () => {
    expect(nextRecurringDate("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextRecurringDate("2026-04-30", "monthly", 31)).toBe("2026-05-31");
  });

  it("berpindah satu tahun dan menjepit 29 Februari", () => {
    expect(nextRecurringDate("2026-08-17", "yearly")).toBe("2027-08-17");
    expect(nextRecurringDate("2024-02-29", "yearly")).toBe("2025-02-28");
    expect(nextRecurringDate("2025-02-28", "yearly", 29)).toBe("2026-02-28");
  });

  it("mengembalikan masukan apa adanya bila tanggalnya tidak valid", () => {
    expect(nextRecurringDate("bukan tanggal", "monthly")).toBe("bukan tanggal");
  });
});

describe("daftar jatuh tempo sampai horizon", () => {
  it("mencakup batas horizon secara inklusif", () => {
    expect(dueDatesUntil("2026-08-01", "monthly", "2026-10-01")).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("berhenti sebelum melewati tanggal berakhir", () => {
    expect(dueDatesUntil("2026-08-01", "monthly", "2026-12-31", "2026-09-15")).toEqual([
      "2026-08-01",
      "2026-09-01",
    ]);
  });

  it("mempertahankan tanggal 31 lintas bulan pendek", () => {
    expect(dueDatesUntil("2026-01-31", "monthly", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("mengosongkan hasil bila horizon sudah lewat", () => {
    expect(dueDatesUntil("2026-08-01", "monthly", "2026-07-01")).toEqual([]);
  });

  /**
   * Penjaga 60 iterasi menyamai batas yang sama di RPC. Satu baris rusak
   * (mis. tanggal mulai tahun 1990) tidak boleh menggantung generator.
   */
  it("berhenti pada 60 periode walau horizonnya jauh", () => {
    const dates = dueDatesUntil("1990-01-01", "monthly", "2030-01-01");
    expect(dates).toHaveLength(60);
  });
});

describe("selisih hari & labelnya", () => {
  it("menghitung selisih hari lintas bulan dan tahun", () => {
    expect(daysBetween("2026-08-01", "2026-08-08")).toBe(7);
    expect(daysBetween("2026-08-08", "2026-08-01")).toBe(-7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
  });

  it("menulis label jatuh tempo dalam bahasa manusia", () => {
    expect(dueLabel("2026-08-01", "2026-08-01")).toBe("Jatuh tempo hari ini");
    expect(dueLabel("2026-08-02", "2026-08-01")).toBe("Besok");
    expect(dueLabel("2026-08-04", "2026-08-01")).toBe("3 hari lagi");
    expect(dueLabel("2026-07-31", "2026-08-01")).toBe("Terlambat 1 hari");
    expect(dueLabel("2026-07-30", "2026-08-01")).toBe("Terlambat 2 hari");
  });

  it("menggeser tanggal maju dan mundur", () => {
    expect(shiftDate("2026-08-01", RECURRING_LEAD_DAYS)).toBe("2026-08-08");
    expect(shiftDate("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("penjaga tipe", () => {
  it("menerima hanya frekuensi yang dikenal", () => {
    expect(isRecurringFrequency("monthly")).toBe(true);
    expect(isRecurringFrequency("harian")).toBe(false);
    expect(isRecurringFrequency(null)).toBe(false);
  });

  it("menerima hanya tanggal ISO yang benar-benar ada", () => {
    expect(isIsoDate("2026-08-01")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("01-08-2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});
