/**
 * Sumber kebenaran TUNGGAL untuk navigasi utama Ayah/Mamah.
 *
 * Hanya ada TIGA tujuan utama. Setiap fungsi belanja hidup di bawah
 * `/admin/belanja` — tidak boleh ada rute atau pintasan Belanja kedua di
 * dalam Keuangan. Menambah entri di sini adalah satu-satunya cara menambah
 * menu, sehingga duplikat mustahil terjadi tanpa disengaja.
 */
export interface MainNavItem {
  href: string;
  label: string;
  /** Deskripsi singkat untuk sidebar desktop. */
  hint: string;
  icon: "wallet" | "cart" | "sparkles";
}

export const MAIN_NAV: MainNavItem[] = [
  { href: "/admin/keuangan", label: "Keuangan", hint: "Saldo, transaksi & analitik", icon: "wallet" },
  { href: "/admin/belanja", label: "Belanja", hint: "Rencana, checklist & struk", icon: "cart" },
  { href: "/admin/dunia-anak", label: "Dunia Anak", hint: "Task, reward & tabungan", icon: "sparkles" },
];

/** Pengaturan sengaja BUKAN menu utama: diakses dari header / kaki sidebar. */
export const SETTINGS_HREF = "/admin/pengaturan";

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
