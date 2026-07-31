import { describe, it, expect, afterEach, vi } from "vitest";
import {
  todayISODate,
  toJakartaISODate,
  toLocalISODate,
  currentMonthISO,
  formatDate,
  formatMonthLabel,
} from "@/lib/format";
import { currentMonth, nextMonth, nextMonthDate, shiftMonth } from "@/lib/period";
import { getWeekRange } from "@/lib/dunia-anak";

/**
 * Tanggal default seluruh form harus "hari ini di Indonesia", bukan hari UTC
 * milik server Vercel maupun hari lokal browser. Setiap kasus di bawah adalah
 * momen yang tanggal UTC-nya BERBEDA dari tanggal WIB-nya — persis kondisi
 * yang dulu membuat pencatatan mundur satu hari setiap dini hari.
 */
describe("hari ini menurut Asia/Jakarta", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dini hari WIB tetap terbaca sebagai hari itu, bukan hari sebelumnya", () => {
    // 1 Agustus 2026 pukul 00:30 WIB = 31 Juli 2026 pukul 17:30 UTC.
    vi.setSystemTime(new Date("2026-07-31T17:30:00Z"));

    expect(new Date().toISOString().slice(0, 10)).toBe("2026-07-31"); // yang lama
    expect(todayISODate()).toBe("2026-08-01"); // yang benar
  });

  it("menjelang tengah malam WIB belum berpindah hari", () => {
    // 31 Juli 2026 pukul 23:59 WIB = 31 Juli pukul 16:59 UTC.
    vi.setSystemTime(new Date("2026-07-31T16:59:00Z"));
    expect(todayISODate()).toBe("2026-07-31");
  });

  it("tepat tengah malam WIB berganti hari", () => {
    vi.setSystemTime(new Date("2026-07-31T17:00:00Z"));
    expect(todayISODate()).toBe("2026-08-01");
  });

  it("memberi hasil yang sama untuk instan yang sama, apa pun zona waktu proses", () => {
    const instant = new Date("2026-08-01T02:15:00Z");
    expect(toJakartaISODate(instant)).toBe("2026-08-01");
    expect(toJakartaISODate(instant.getTime())).toBe("2026-08-01");
  });

  it("bulan berjalan ikut memakai waktu Indonesia, jadi awal bulan tidak mundur", () => {
    // Awal Agustus WIB, masih Juli menurut UTC.
    vi.setSystemTime(new Date("2026-07-31T17:30:00Z"));
    expect(currentMonthISO()).toBe("2026-08");
    expect(currentMonth()).toBe("2026-08");
  });
});

describe("tanggal kalender tidak digeser zona waktu", () => {
  it("menampilkan tanggal transaksi persis seperti yang disimpan", () => {
    expect(formatDate("2026-08-01")).toBe("1 Agustus 2026");
    expect(formatDate("2026-01-31")).toBe("31 Januari 2026");
  });

  it("menyusun ISO dari komponen lokal, bukan lewat UTC", () => {
    expect(toLocalISODate(new Date(2026, 7, 1))).toBe("2026-08-01");
    expect(toLocalISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("rentang minggu tugas anak tidak mundur sehari", () => {
    // 1 Agustus 2026 adalah hari Sabtu; minggunya Senin 27 Juli – Minggu 2 Agustus.
    expect(getWeekRange("2026-08-01")).toEqual({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
    });
  });
});

describe("rencana bulan berikutnya", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bulan depan dihitung dari hari ini versi Indonesia", () => {
    vi.setSystemTime(new Date("2026-07-31T17:30:00Z")); // 1 Agustus WIB
    expect(nextMonth()).toBe("2026-09");
  });

  it("melewati pergantian tahun", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(nextMonth("2026-12-15")).toBe("2027-01");
  });

  it("mempertahankan tanggal belanja sumber di bulan berikutnya", () => {
    expect(nextMonthDate("2026-07-05", "2026-07-20")).toBe("2026-08-05");
  });

  it("menjepit tanggal yang tidak ada di bulan tujuan", () => {
    // 31 Januari → Februari hanya sampai tanggal 28 (2027 bukan kabisat).
    expect(nextMonthDate("2027-01-31", "2027-01-15")).toBe("2027-02-28");
  });

  it("jatuh ke tanggal 1 bila belanja sumber tidak bertanggal", () => {
    expect(nextMonthDate(null, "2026-08-09")).toBe("2026-09-01");
  });

  it("memberi label periode yang terbaca manusia", () => {
    expect(formatMonthLabel("2026-08")).toBe("Agustus 2026");
  });
});
