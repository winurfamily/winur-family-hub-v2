# 05_IMPLEMENTATION_PLAN.md
Project: Winur Family Hub V2
Status: LOCKED

---

## Rule

Selesaikan 1 sprint penuh sebelum lanjut.
Sprint selesai = UI ✓ Logic ✓ DB ✓ Animasi ✓ Sound ✓ Responsive ✓

---

## Sprint 1 — FOUNDATION

- [ ] Setup Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [ ] Setup Supabase client + types + Realtime
- [ ] Jalankan migration semua tabel dari 03_DATABASE_ERD.md
- [ ] Seed data (family, 4 profiles, default pockets, default avatar)
- [ ] Setup Howler.js + placeholder sound files di public/sounds/
- [ ] First Time Setup Wizard (5 step, harus selesai semua)
- [ ] Profile Picker (Netflix-style, game theme)
- [ ] PIN modal admin (6 digit, bcrypt)
- [ ] Session Zustand + localStorage
- [ ] Route guard /admin/* dan /child/[id]/*
- [ ] Switch profile (tombol pojok, admin PIN)
- [ ] Design system: CSS variables, fonts, dark/light
- [ ] Admin bottom nav (Keuangan | Dunia Anak)
- [ ] Loading states (progress bar admin, skeleton child)

Output: bisa login semua profil.

---

## Sprint 2 — ADMIN KEUANGAN

- [ ] Dashboard keuangan: saldo utama, per pocket, pengeluaran
- [ ] Input pendapatan (sumber bebas)
- [ ] Pocket manager (default + custom, split %)
- [ ] Validasi split max 100%
- [ ] Transfer antar pocket
- [ ] Riwayat transfer
- [ ] Belanja: quick scan (AI), full scan, manual
- [ ] Database produk anti-duplicate
- [ ] Rencana belanja + checklist real
- [ ] Saldo belanja dari real belanja
- [ ] Riwayat belanja per bulan

Output: keuangan keluarga fully functional.

---

## Sprint 3 — ADMIN DUNIA ANAK

- [ ] Pilih anak → overview (avatar, level, XP, saldo, point)
- [ ] Generate task AI → review → publish (max 3/hari)
- [ ] Generate tugas AI → 5 soal pilgan → review → publish (max 1/hari)
- [ ] Approve task submitted → saldo + point + XP masuk
- [ ] Riwayat task per anak
- [ ] Streak monitor per anak (weekly_streaks)
- [ ] Klaim mingguan: approve/reject (hanya Minggu)
- [ ] Riwayat klaim
- [ ] Setting investasi % per anak
- [ ] Konfirmasi investasi selesai
- [ ] Point shop: tambah hadiah real, approve request
- [ ] Settings: PIN, profil anak, reward default, sound, tema

Output: admin bisa kelola semua aspek dunia anak.

---

## Sprint 4 — ADMIN AVATAR & PET

- [ ] Menu Assets: library semua avatar + pet
- [ ] Generate avatar via DALL-E 3 (Server Action)
- [ ] Preview hasil generate
- [ ] Assign avatar ke level unlock
- [ ] Upload foto profil anak
- [ ] Generate pet via DALL-E 3
- [ ] Assign pet ke level unlock
- [ ] Fallback avatar (CSS circle + inisial) saat generate belum ada

Output: admin bisa kelola avatar & pet library.

---

## Sprint 5 — CHILD WORLD

- [ ] Layout game-style full screen iPad-first
- [ ] Avatar hero besar + animasi idle breathing
- [ ] Pet display + animasi idle bounce
- [ ] Stats bar: level, XP, saldo, point
- [ ] XP bar animasi smooth
- [ ] Task cards (3 task) dengan reward display
- [ ] Tugas card (5 soal pilgan, satu per satu)
- [ ] Submit task/tugas → pending → konfirmasi
- [ ] Streak widget (7 kotak Senin-Minggu)
- [ ] Tombol Klaim (aktif hanya Minggu)
- [ ] Modal klaim: input nominal + konfirmasi
- [ ] Widget investasi mini + progress bar
- [ ] Modal mulai investasi (input nominal)
- [ ] Pilih avatar (grid koleksi unlock)
- [ ] Pilih pet (grid koleksi unlock)
- [ ] Cosmos/theme background

Output: anak bisa bermain penuh.

---

## Sprint 6 — ANIMASI, SOUND & POLISH

- [ ] Semua sound effects dari 02_DESIGN_SYSTEM.md
- [ ] Toggle sound di Settings
- [ ] Level up: full screen confetti + fanfare
- [ ] Unlock avatar/pet: modal sparkle + sound
- [ ] Coin particle saat task approved
- [ ] XP bar fill animasi + glow
- [ ] Streak kotak bounce saat complete
- [ ] Streak bonus: animasi bintang rainbow
- [ ] Investasi selesai: modal kado
- [ ] Klaim approved: modal sukses
- [ ] Notifikasi in-app semua trigger
- [ ] Error state + retry semua halaman
- [ ] Empty state semua halaman
- [ ] Responsive: iPad ✓ Desktop ✓ Mobile ✓
- [ ] Audit log: semua perubahan saldo/point/xp
- [ ] Cron: task reset 00:00
- [ ] Cron: streak reset Senin 00:01
- [ ] RLS Supabase aktif
- [ ] Test semua checklist 06_DECISION_LOG.md

Output: READY FOR RELEASE ✅

---

## Sprint 7 — PWA & APK BUILD

- [ ] Install next-pwa
- [ ] Setup manifest.json (nama, icon, theme color, standalone)
- [ ] Buat icon app 192×192 dan 512×512
- [ ] Service worker: cache static assets
- [ ] Test install via Chrome "Add to Home Screen"
- [ ] Install Capacitor: @capacitor/core + @capacitor/cli + @capacitor/android
- [ ] Setup capacitor.config.ts
- [ ] Env variable NEXT_PUBLIC_MODE=apk
- [ ] APK build: hanya expose /child/* routes
- [ ] Hide semua admin routes saat mode=apk
- [ ] Profile picker APK: hanya tampil profil anak
- [ ] PIN 4 digit untuk anak di APK
- [ ] Splash screen APK
- [ ] Status bar warna tema
- [ ] Safe area insets (notch Android)
- [ ] Touch target semua elemen min 48×48px
- [ ] Tap feedback: scale + ripple semua button
- [ ] Test di Android tablet (landscape + portrait)
- [ ] Build APK: npx cap build android
- [ ] Generate signed APK
- [ ] Test install file APK di tablet

**Step by step build APK (untuk user):**
1. Install Android Studio dari developer.android.com
2. Install Java JDK 17
3. Buka project → terminal: `next build && npx cap sync android`
4. Buka Android Studio: `npx cap open android`
5. Build → Generate Signed Bundle/APK → APK → Next
6. Buat keystore baru (simpan file .jks, jangan hilang!)
7. Build release → ambil file .apk di folder app/release/
8. Share via WhatsApp/kabel ke tablet anak
9. Di tablet: Settings → Allow install from unknown sources → install APK

Output: file .apk siap di-share dan di-install di tablet Android.
