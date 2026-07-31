import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Alias "@/..." disamakan dengan tsconfig.json. Ditulis manual (bukan
    // lewat vite-tsconfig-paths) karena paket itu ESM-only dan tidak bisa
    // dimuat dari config CommonJS di proyek ini.
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Penjaga `import "server-only"` melempar error di luar Server Component.
      // Di lingkungan test Node penjaga itu tidak relevan, jadi diganti modul
      // kosong agar helper sisi-server tetap bisa diuji langsung.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Test integrasi menyentuh satu database yang sama, jadi tidak boleh
    // berjalan paralel — saldo akan saling menimpa.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["tests/setup.ts"],
  },
});
