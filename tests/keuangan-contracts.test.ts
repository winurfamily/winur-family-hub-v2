import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { MAIN_NAV, SETTINGS_HREF, isNavActive } from "@/components/shell/nav-items";
import {
  expenseVisual,
  incomeVisual,
  ledgerVisual,
  MANUAL_EXPENSE_CATEGORIES,
  MANUAL_EXPENSE_VISUALS,
  INCOME_VISUAL_LIST,
} from "@/lib/finance-categories";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
} from "@/lib/supabase/types";

const root = path.resolve(__dirname, "..");

describe("navigasi utama", () => {
  it("hanya punya tiga menu utama", () => {
    expect(MAIN_NAV).toHaveLength(3);
    expect(MAIN_NAV.map((item) => item.label)).toEqual(["Keuangan", "Belanja", "Dunia Anak"]);
  });

  it("tidak punya rute Belanja ganda dan Belanja tidak berada di dalam Keuangan", () => {
    const belanja = MAIN_NAV.filter((item) => item.href.includes("belanja"));
    expect(belanja).toHaveLength(1);
    expect(belanja[0].href).toBe("/admin/belanja");
    expect(belanja[0].href.startsWith("/admin/keuangan")).toBe(false);
  });

  it("Pengaturan sengaja bukan menu utama", () => {
    expect(MAIN_NAV.some((item) => item.href === SETTINGS_HREF)).toBe(false);
  });

  it("menandai menu aktif termasuk sub-rutenya, tanpa saling menimpa", () => {
    expect(isNavActive("/admin/belanja/abc", "/admin/belanja")).toBe(true);
    expect(isNavActive("/admin/keuangan", "/admin/belanja")).toBe(false);
    // "/admin/keuangan-lain" bukan bagian dari "/admin/keuangan".
    expect(isNavActive("/admin/keuangan-lain", "/admin/keuangan")).toBe(false);
  });
});

describe("rupa kategori (ikon pengeluaran & pendapatan)", () => {
  it("setiap kategori pengeluaran punya ikon, warna, dan label", () => {
    for (const key of EXPENSE_CATEGORIES) {
      const visual = expenseVisual(key);
      expect(visual.Icon, `ikon hilang untuk ${key}`).toBeTruthy();
      expect(visual.fg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.label).toBeTruthy();
    }
  });

  it("setiap kategori pendapatan punya ikon, warna, dan label", () => {
    for (const key of INCOME_CATEGORIES) {
      const visual = incomeVisual(key);
      expect(visual.Icon, `ikon hilang untuk ${key}`).toBeTruthy();
      expect(visual.label).toBe(INCOME_CATEGORY_LABELS[key]);
    }
  });

  it("alias kategori lama memakai rupa kategori aktifnya", () => {
    for (const [alias, target] of Object.entries(EXPENSE_CATEGORY_ALIASES)) {
      const visual = expenseVisual(alias);
      expect(visual.key).toBe(target);
      expect(visual.label).toBe(EXPENSE_CATEGORY_LABELS[target!]);
    }
  });

  it("kategori tak dikenal atau kosong tetap dapat rupa cadangan", () => {
    expect(expenseVisual(null).label).toBe("Lainnya");
    expect(expenseVisual("kategori_yang_tidak_ada").label).toBe("Lainnya");
    expect(incomeVisual(undefined).label).toBe("Lainnya");
  });

  it("transfer punya rupanya sendiri, bukan rupa kategori", () => {
    const visual = ledgerVisual("transfer", null);
    expect(visual.key).toBe("transfer");
    expect(visual.label).toBe("Transfer");
  });

  it("baris riwayat memakai rupa sesuai jenisnya", () => {
    expect(ledgerVisual("income", "gaji").label).toBe("Gaji");
    expect(ledgerVisual("expense", "makanan").label).toBe("Makanan");
  });
});

describe("pemilih kategori pengeluaran manual", () => {
  it("TIDAK menyediakan kategori Belanja — hanya menu Belanja yang boleh membuatnya", () => {
    expect(MANUAL_EXPENSE_CATEGORIES).not.toContain("belanja");
    expect(MANUAL_EXPENSE_CATEGORIES).not.toContain("belanja_rumah");
  });

  it("tidak menampilkan kategori ganda", () => {
    const keys = MANUAL_EXPENSE_VISUALS.map((visual) => visual.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("semua pilihan grid punya ikon sehingga tidak ada petak kosong", () => {
    for (const visual of [...MANUAL_EXPENSE_VISUALS, ...INCOME_VISUAL_LIST]) {
      expect(visual.Icon).toBeTruthy();
      expect(visual.label.length).toBeGreaterThan(0);
    }
  });
});

describe("cache service worker (regresi saldo lama muncul kembali)", () => {
  const config = readFileSync(path.join(root, "next.config.mjs"), "utf-8");

  it("tidak meng-cache navigasi di muka, agar angka saldo tidak disajikan dari cache lama", () => {
    expect(config).toMatch(/cacheOnFrontEndNav:\s*false/);
    expect(config).toMatch(/aggressiveFrontEndNavCaching:\s*false/);
  });
});

describe("revalidasi setelah mutasi keuangan", () => {
  const helpers = readFileSync(path.join(root, "src/lib/server/finance-helpers.ts"), "utf-8");

  it("membersihkan cache Keuangan dan Belanja beserta seluruh sub-rutenya", () => {
    expect(helpers).toContain('revalidatePath("/admin/keuangan", "layout")');
    expect(helpers).toContain('revalidatePath("/admin/belanja", "layout")');
  });
});

describe("halaman Keuangan selalu dirender ulang", () => {
  it("memakai force-dynamic agar saldo tidak diambil dari cache halaman", () => {
    const page = readFileSync(path.join(root, "src/app/admin/keuangan/page.tsx"), "utf-8");
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("tidak ada nominal saldo yang di-hardcode", () => {
  it("tidak ada angka 4.000.000 sebagai fallback di kode aplikasi", () => {
    const files = [
      "src/app/actions/keuangan.ts",
      "src/app/actions/pendapatan.ts",
      "src/app/actions/setup.ts",
      "src/app/admin/keuangan/_components/keuangan-hub.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf-8");
      expect(source, `${file} memuat nominal hardcode`).not.toMatch(/4[._]?000[._]?000/);
    }
  });

  it("ringkasan saldo selalu jatuh ke 0 saat data belum ada", () => {
    const source = readFileSync(path.join(root, "src/app/admin/keuangan/_components/keuangan-hub.tsx"), "utf-8");
    expect(source).toContain("summary?.saldoUtama ?? 0");
    expect(source).toContain("summary?.totalKeluarga ?? 0");
    expect(source).toContain("summary?.totalPockets ?? 0");
  });
});
