import { describe, it, expect } from "vitest";
import {
  budgetStatus,
  usagePercent,
  monthOverMonth,
  buildFinanceAlerts,
  BUDGET_THRESHOLDS,
  TOTAL_BUDGET_KEY,
  type AlertInput,
} from "@/lib/budget-alerts";

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    month: "2026-08",
    totalBudget: 0,
    totalSpent: 0,
    income: 0,
    expense: 0,
    lines: [],
    ...overrides,
  };
}

describe("persentase & status anggaran", () => {
  it("menghitung persentase pemakaian", () => {
    expect(usagePercent(750_000, 1_000_000)).toBe(75);
    expect(usagePercent(1_200_000, 1_000_000)).toBe(120);
    expect(usagePercent(0, 1_000_000)).toBe(0);
  });

  it("mengembalikan 0 bila belum ada anggaran", () => {
    expect(usagePercent(500_000, 0)).toBe(0);
    expect(usagePercent(500_000, -1)).toBe(0);
  });

  it("membatasi angka ekstrem agar tata letak tidak rusak", () => {
    expect(usagePercent(1_000_000_000, 1_000)).toBe(999);
  });

  it("memetakan persentase ke empat status", () => {
    expect(budgetStatus(0)).toBe("aman");
    expect(budgetStatus(74)).toBe("aman");
    expect(budgetStatus(75)).toBe("mendekati");
    expect(budgetStatus(89)).toBe("mendekati");
    expect(budgetStatus(90)).toBe("hampir");
    expect(budgetStatus(99)).toBe("hampir");
    expect(budgetStatus(100)).toBe("lewat");
    expect(budgetStatus(250)).toBe("lewat");
  });

  it("membandingkan dengan bulan sebelumnya", () => {
    expect(monthOverMonth(1_200_000, 1_000_000)).toBe(20);
    expect(monthOverMonth(800_000, 1_000_000)).toBe(-20);
    expect(monthOverMonth(500_000, 0)).toBeNull();
  });
});

describe("peringatan ambang anggaran", () => {
  const line = (spent: number) => [
    { categoryKey: "makanan", label: "Makanan", amount: 1_000_000, spent },
  ];

  it("diam selama pemakaian masih di bawah 75%", () => {
    const alerts = buildFinanceAlerts(input({ lines: line(700_000) }));
    expect(alerts).toHaveLength(0);
  });

  it("memberi info pada 75%", () => {
    const alerts = buildFinanceAlerts(input({ lines: line(750_000) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("info");
    expect(alerts[0].id).toContain(":75");
    expect(alerts[0].target).toBe("anggaran");
  });

  it("menaikkan tingkat menjadi warning pada 90%", () => {
    const alerts = buildFinanceAlerts(input({ lines: line(900_000) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("warning");
    expect(alerts[0].id).toContain(":90");
  });

  it("menaikkan tingkat menjadi danger pada 100% ke atas", () => {
    const alerts = buildFinanceAlerts(input({ lines: line(1_050_000) }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("danger");
    expect(alerts[0].id).toContain(":100");
    expect(alerts[0].title).toContain("terlampaui");
  });

  /**
   * Satu kategori = SATU kartu. Melewati 100% tidak boleh memunculkan tiga
   * kartu (75, 90, 100) untuk hal yang sama.
   */
  it("hanya menghasilkan satu kartu per kategori", () => {
    const alerts = buildFinanceAlerts(input({ lines: line(2_000_000) }));
    const forMakanan = alerts.filter((a) => a.id.startsWith("budget:makanan"));
    expect(forMakanan).toHaveLength(1);
  });

  /**
   * Id memuat ambang yang terlampaui, sehingga menutup kartu 75% tidak ikut
   * membungkam kartu 90% yang muncul kemudian.
   */
  it("memberi id berbeda tiap kenaikan ambang", () => {
    const ids = [750_000, 900_000, 1_000_000].map(
      (spent) => buildFinanceAlerts(input({ lines: line(spent) }))[0].id
    );
    expect(new Set(ids).size).toBe(3);
    for (const threshold of BUDGET_THRESHOLDS) {
      expect(ids.some((id) => id.endsWith(`:${threshold}`))).toBe(true);
    }
  });

  it("mengabaikan kategori yang belum dianggarkan", () => {
    const alerts = buildFinanceAlerts(
      input({ lines: [{ categoryKey: "hiburan", label: "Hiburan", amount: 0, spent: 5_000_000 }] })
    );
    expect(alerts).toHaveLength(0);
  });

  it("memperingatkan anggaran total secara terpisah", () => {
    const alerts = buildFinanceAlerts(
      input({ totalBudget: 5_000_000, totalSpent: 4_600_000 })
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe(`budget-total:2026-08:90`);
    expect(alerts[0].level).toBe("warning");
  });

  it("memakai kalimat khusus untuk kategori Belanja", () => {
    const alerts = buildFinanceAlerts(
      input({ lines: [{ categoryKey: "belanja", label: "Belanja", amount: 2_000_000, spent: 1_600_000 }] })
    );
    expect(alerts[0].message).toContain("Sisa Rp 400.000 untuk belanja bulan ini");
  });
});

describe("peringatan di luar anggaran", () => {
  it("memperingatkan saat pengeluaran melebihi pendapatan", () => {
    const alerts = buildFinanceAlerts(input({ income: 5_000_000, expense: 6_500_000 }));
    const overspend = alerts.find((a) => a.id.startsWith("overspend"));
    expect(overspend).toBeDefined();
    expect(overspend!.level).toBe("danger");
    expect(overspend!.message).toContain("Rp 1.500.000");
  });

  it("diam saat pendapatan masih menutupi pengeluaran", () => {
    expect(buildFinanceAlerts(input({ income: 7_000_000, expense: 6_500_000 }))).toHaveLength(0);
  });

  it("diam pada bulan yang belum ada pengeluaran sama sekali", () => {
    expect(buildFinanceAlerts(input({ income: 0, expense: 0 }))).toHaveLength(0);
  });

  it("memperingatkan akun bersaldo minus atau kosong", () => {
    const alerts = buildFinanceAlerts(
      input({
        lowAccounts: [
          { name: "Pocket Belanja", balance: -50_000 },
          { name: "Dana Sekolah", balance: 0 },
          { name: "Tabungan", balance: 100_000 },
        ],
      })
    );
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("low-account:Pocket Belanja");
    expect(ids).toContain("low-account:Dana Sekolah");
    expect(ids).not.toContain("low-account:Tabungan");
    expect(alerts.find((a) => a.id === "low-account:Pocket Belanja")!.level).toBe("danger");
  });

  it("memperingatkan tagihan rutin yang melebihi dana tersedia", () => {
    const alerts = buildFinanceAlerts(
      input({ upcomingRecurring: { total: 3_000_000, count: 2, available: 1_000_000 } })
    );
    const short = alerts.find((a) => a.id.startsWith("recurring-short"));
    expect(short).toBeDefined();
    expect(short!.target).toBe("rutin");
  });

  it("diam bila dana masih cukup untuk tagihan rutin", () => {
    const alerts = buildFinanceAlerts(
      input({ upcomingRecurring: { total: 1_000_000, count: 2, available: 5_000_000 } })
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("urutan peringatan", () => {
  it("menaruh yang paling mendesak lebih dulu", () => {
    const alerts = buildFinanceAlerts(
      input({
        income: 1_000_000,
        expense: 2_000_000,
        lines: [
          { categoryKey: "makanan", label: "Makanan", amount: 1_000_000, spent: 780_000 },
          { categoryKey: "tagihan", label: "Tagihan", amount: 1_000_000, spent: 950_000 },
        ],
      })
    );
    expect(alerts.map((a) => a.level)).toEqual(["danger", "warning", "info"]);
  });
});

describe("kunci anggaran total", () => {
  /**
   * Sentinel teks, bukan NULL: Postgres tidak menganggap dua NULL bentrok,
   * jadi `unique (family_id, month, category_key)` tidak akan mencegah baris
   * total ganda kalau kuncinya NULL.
   */
  it("bukan nama kategori yang valid", () => {
    expect(TOTAL_BUDGET_KEY).toBe("__total__");
    expect(TOTAL_BUDGET_KEY.startsWith("__")).toBe(true);
  });
});
