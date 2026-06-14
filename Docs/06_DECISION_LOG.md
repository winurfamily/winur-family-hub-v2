# 06_DECISION_LOG.md
Project: Winur Family Hub V2
Status: LOCKED

| # | Topik | Keputusan | Status |
|---|---|---|---|
| 1 | Framework | Next.js 14 App Router + TypeScript strict | LOCKED |
| 2 | Deploy Web | Vercel — full app admin + anak | LOCKED |
| 3 | Deploy APK | Capacitor → APK Android — hanya mode anak | LOCKED |
| 4 | PWA | manifest + service worker, bisa install ke home screen | LOCKED |
| 5 | Database | Supabase PostgreSQL + Realtime + Storage | LOCKED |
| 6 | AI Text | OpenAI GPT-4o (task, tugas, scan struk) | LOCKED |
| 7 | AI Image | DALL-E 3, 512px, hemat storage | LOCKED |
| 8 | Login Web | Profile picker → Admin PIN 6 digit / Child PIN 4 digit | LOCKED |
| 9 | Login APK | Hanya anak, PIN 4 digit | LOCKED |
| 10 | PIN Anak | 4 digit, admin yang set dari web | LOCKED |
| 11 | Nav Anak | Bottom nav 6 menu: Beranda, Investasi, Avatar, Klaim Saldo, Point Shop, Riwayat | LOCKED |
| 12 | Nav Admin | Bottom nav 2 menu: Keuangan, Dunia Anak | LOCKED |
| 13 | Warna | Sky Adventure — biru langit + oranye + hijau + ungu. BUKAN gelap | LOCKED |
| 14 | Design Ref | Ikuti referensi gambar di docs/design_ref/ untuk layout & komponen | LOCKED |
| 15 | Task per hari | Max 3 task + 1 tugas | LOCKED |
| 16 | Task reward | Rp 1.000 + 1 point + 1 XP per task | LOCKED |
| 17 | Tugas reward | Rp 2.000 + 2 point + 2 XP per tugas | LOCKED |
| 18 | Max/minggu | Rp 50.000 + 50 point + 35 XP (dengan streak) | LOCKED |
| 19 | Klaim | Per task, otomatis setelah admin approve, kapan saja | LOCKED |
| 20 | Tarik Dana | Hanya Minggu, input nominal, butuh approve admin | LOCKED |
| 21 | Streak | Senin-Minggu 7 hari, bonus Rp 15.000 + 15 point, reset Senin 00:01 | LOCKED |
| 22 | Investasi | 1 bulan, tidak bisa batal, return % admin set | LOCKED |
| 23 | Investasi quick | Tombol +10rb, +25rb, +50rb, Semua | LOCKED |
| 24 | Point Shop | Lock by jumlah point. Konten kosong dulu, admin isi | LOCKED |
| 25 | Point Shop item | Admin generate via AI (gambar + nama + harga point) | LOCKED |
| 26 | Avatar | Base sama, kostum beda. Admin generate via DALL-E 3 | LOCKED |
| 27 | Avatar unlock | Otomatis saat naik level, assign by admin | LOCKED |
| 28 | Avatar default | 1 karakter base saat setup (tanpa kostum) | LOCKED |
| 29 | Avatar gambar | 512px PNG, hemat storage | LOCKED |
| 30 | Task gambar | DALL-E 3 512px per task/tugas | LOCKED |
| 31 | Riwayat | Filter per kategori + rentang waktu + pagination | LOCKED |
| 32 | XP Formula | round(20 × 1.4^(level-1)) | LOCKED |
| 33 | Level unlimited | Ya, tidak ada prestige | LOCKED |
| 34 | Sound | Howler.js, toggle on/off, <50KB | LOCKED |
| 35 | Animasi | 60fps, idle avatar, coin rain, confetti level up | LOCKED |
| 36 | Responsive | Tablet-first, touch target 48px, ripple effect, safe area | LOCKED |
| 37 | Saldo anak | Terpisah dari saldo keluarga | LOCKED |
| 38 | Audit log | Wajib semua perubahan saldo/point/xp | LOCKED |
| 39 | Delete policy | Tidak ada delete, semua archive | LOCKED |
| 40 | RLS | OFF awal, aktif Sprint 6 | LOCKED |
