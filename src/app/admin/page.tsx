import { redirect } from "next/navigation";

/**
 * `/admin` tidak lagi menjadi dashboard tersendiri.
 *
 * Dashboard lama menampilkan enam kartu pintasan (termasuk Belanja dan Riwayat)
 * yang menduplikasi menu utama. Sekarang Ayah/Mamah langsung mendarat di
 * Keuangan, dan satu-satunya navigasi adalah tiga menu utama di cangkang.
 */
export default function AdminHomePage() {
  redirect("/admin/keuangan");
}
