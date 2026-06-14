# 01_PRD.md — PRODUCT REQUIREMENTS
Project: Winur Family Hub V2
Status: LOCKED

---

## ROLES

### Admin (Ayah, Mamah)
- Kelola keuangan keluarga
- Generate & publish task/tugas via AI (dengan gambar)
- Approve task selesai → otomatis masuk "Siap Diklaim" anak
- Approve Tarik Dana mingguan (hari Minggu)
- Generate avatar baru via AI (base sama, kostum beda) → assign level
- Generate item Point Shop via AI → set harga point
- Approve request Point Shop
- Set PIN anak (4 digit)
- Setting investasi %

### Child (Daffa, Dio)
- Kerjakan task & tugas harian
- Klaim reward per task (otomatis setelah admin approve)
- Tarik Dana ke cash (hanya Minggu, butuh approve admin)
- Investasi saldo
- Pilih avatar dari koleksi unlock
- Tukar point di Point Shop
- Lihat riwayat semua aktivitas

---

## VERSI APLIKASI

### Web (Vercel) — Full App
- Admin + anak
- PWA: bisa install ke home screen
- Untuk Ayah & Mamah kelola semua

### APK Android (Capacitor) — Child Only
- Hanya mode anak
- Share file APK langsung
- Data sync online via Supabase
- Profile picker hanya tampil anak
- PIN 4 digit untuk masuk

---

## LOGIN

### Web
- Profile picker: 4 kartu (Ayah, Mamah, Daffa, Dio)
- Admin → PIN 6 digit
- Child → PIN 4 digit (admin yang set)
- Tombol switch profile di pojok

### APK
- Profile picker: hanya Daffa & Dio
- Child → PIN 4 digit
- Tidak ada akses admin

---

## NAVIGASI ANAK (Bottom Nav 6 Menu)

1. **Beranda** — dashboard utama
2. **Investasi** — kelola investasi
3. **Avatar** — koleksi & ganti avatar
4. **Klaim Saldo** — klaim reward + tarik dana
5. **Point Shop** — tukar point hadiah
6. **Riwayat** — semua aktivitas

---

## NAVIGASI ADMIN (Bottom Nav 2 Menu)

1. **Keuangan** — finance keluarga
2. **Dunia Anak** — semua setting anak

---

## MODUL ADMIN

### 1. KEUANGAN
- Input pendapatan → saldo utama
- Pocket system (default + custom)
- Split % ke pocket
- Transfer antar pocket
- Belanja: scan struk AI + manual + rencana
- Dashboard saldo + riwayat

### 2. DUNIA ANAK

Sub-menu per anak:

#### Overview
- Avatar, nama, level, XP, saldo, point
- Status task hari ini
- Streak minggu ini
- Investasi aktif

#### Task & Tugas
- Generate task via AI → gambar otomatis di-generate (512px, hemat storage)
- Generate tugas (5 soal pilgan) via AI → gambar ilustrasi soal
- Max 3 task + 1 tugas per hari
- Reward per task: Rp 1.000 + 1 point + 1 XP
- Reward per tugas: Rp 2.000 + 2 point + 2 XP
- Approve task → otomatis masuk "Siap Diklaim" di anak
- Riwayat task per anak

#### Avatar
- Generate avatar baru: admin input deskripsi kostum
- AI generate karakter base + kostum (DALL-E 3, 512px)
- Assign ke level unlock
- Library semua avatar yang sudah dibuat
- 1 karakter base default saat pertama (tanpa kostum)

#### Investasi
- Monitor status per anak
- Set % return per anak
- Konfirmasi investasi selesai → saldo anak bertambah

#### Tarik Dana
- Hanya aktif hari Minggu
- List request tarik dana per anak
- Nominal + saldo tersisa
- Approve → kasih cash langsung
- Riwayat tarik dana

#### Point Shop
- Generate item via AI (nama + deskripsi + gambar 512px)
- Set harga point minimum (lock by point)
- Approve/reject request tukar
- Menu siap ada, konten diisi admin

#### Settings
- Ganti PIN admin (6 digit)
- Set PIN anak (4 digit) per anak
- Edit profil anak (nama, usia)
- Default reward task & tugas
- % return investasi per anak
- Streak bonus (default Rp 15.000 + 15 point)
- Tema background per anak
- Sound on/off

---

## MODUL CHILD

### Beranda
Layout: header + hero avatar + stats + streak + task cards + widget investasi

**Header (top bar):**
- Kiri: avatar mini + nama + level badge + XP bar
- Kanan: saldo pill (Rp) + point pill (⭐) + notif bell

**Hero Section:**
- Avatar besar (kiri) + pet (kiri bawah)
- Nama besar + saldo card + point card
- Progress hari ini (X/4)

**Streak Mingguan:**
- 7 kotak (Sen-Min), hijau = done
- Bonus info: Rp 15.000 + 15 point jika 7/7
- Tombol Klaim Bonus (aktif Minggu jika 7/7)

**Task Cards (horizontal scroll):**
- 3 task card + 1 tugas card
- Tiap card: gambar AI + judul + reward (Rp + ⭐) + tombol Mulai/Selesai

**Widget Investasi:**
- Modal + estimasi hasil + progress bar + tanggal selesai

---

### Investasi
- Summary: total diinvestasi + estimasi total hasil + jumlah aktif
- List investasi aktif: progress bar + sisa hari + tanggal selesai
- Form mulai baru (kanan): input nominal + quick buttons (+10rb, +25rb, +50rb, Semua) + estimasi hasil real-time
- "Investasi tidak dapat dibatalkan" label
- Tidak bisa mulai baru jika ada yang aktif

---

### Avatar (Koleksi)
- Counter: X/total terkumpul
- Grid 3 kolom (tablet)
- Avatar unlock: berwarna + bisa dipilih
- Avatar terkunci: grayscale + gembok + "Level X"
- Avatar aktif: border ungu + centang hijau + label "Digunakan"
- Info: "Naik level untuk membuka avatar baru!"

---

### Klaim Saldo
**3 stat cards atas:**
- Saldo Tersedia (siap diklaim)
- Total Diklaim (sepanjang waktu)
- Menunggu Approval (tarik dana pending)

**Tab: Siap Diklaim | Menunggu Approval | Riwayat**

**Siap Diklaim:**
- List task yang sudah di-approve admin
- Per item: gambar + judul + tanggal approve + reward Rp + tombol Klaim
- Tombol "Klaim Semua" di bawah
- Klaim = OTOMATIS (tidak butuh approve), saldo langsung bertambah

**Tarik Dana (hanya Minggu):**
- Input nominal yang mau ditarik
- Submit → pending → admin approve → kasih cash
- Tombol disabled + info "Tersedia setiap hari Minggu" jika bukan Minggu

---

### Point Shop
- Header: Point Kamu: X
- Grid item hadiah
- Badge TERSEDIA vs LOCKED
- Item locked: "Butuh X Point" (lock by jumlah point minimum)
- Tombol Tukar → request → admin approve
- Menu siap ada, item diisi admin
- State kosong: "Belum ada hadiah. Minta Ayah/Mamah untuk menambahkan!"

---

### Riwayat
- Filter sidebar: Semua | Klaim Saldo | Investasi | Tugas | Point Shop | Tarik Saldo
- Filter rentang waktu
- Tabel: ikon + aktivitas + detail + jumlah (+ hijau / - merah) + tanggal
- Badge warna per tipe transaksi
- Pagination

---

## REWARD SYSTEM

```
3 task × Rp 1.000 × 7 hari  = Rp 21.000 + 21 point + 21 XP
1 tugas × Rp 2.000 × 7 hari = Rp 14.000 + 14 point + 14 XP
Bonus streak 7/7             = Rp 15.000 + 15 point
─────────────────────────────────────────────────────────────
Total maksimal/minggu        = Rp 50.000 + 50 point + 35 XP
```

---

## KLAIM vs TARIK DANA

```
Task selesai
→ Admin approve
→ Otomatis masuk tab "Siap Diklaim"
→ Anak klik Klaim (kapan saja, otomatis)
→ Saldo anak bertambah
↓
Hari Minggu:
→ Anak input nominal Tarik Dana
→ Submit → pending admin
→ Admin approve → kasih cash langsung
→ Saldo berkurang
```

---

## INVESTASI

- Input nominal dari saldo tersedia
- Dikunci 1 bulan (30 hari)
- TIDAK BISA dibatalkan
- Return % di-set admin
- Progress bar + estimasi hasil real-time
- Selesai → notif anak → admin konfirmasi → saldo bertambah
- Quick input: +10rb, +25rb, +50rb, Semua

---

## AVATAR SYSTEM

- Base karakter: 1 default per anak (dibuat saat setup)
- Admin generate kostum baru: input deskripsi → DALL-E 3 generate
- Gambar 512×512px (hemat storage Supabase)
- Assign ke level unlock
- Anak unlock otomatis saat naik level
- Koleksi tampil di halaman Avatar

### DALL-E 3 Prompt Template
```
3D cartoon character, child boy, full body front view,
same base character (brown hair, round face, friendly smile),
wearing [DESKRIPSI KOSTUM ADMIN],
game character style, colorful, bright background,
512x512px, high quality illustration
```

---

## AI GENERATION (semua via Server Action)

| Item | AI | Ukuran | Storage |
|---|---|---|---|
| Gambar task | DALL-E 3 | 512px | ~50-80KB |
| Gambar tugas | DALL-E 3 | 512px | ~50-80KB |
| Avatar kostum | DALL-E 3 | 512px | ~80-100KB |
| Item point shop | DALL-E 3 | 512px | ~50-80KB |
| Generate teks task | GPT-4o | - | - |
| Generate soal tugas | GPT-4o | - | - |
| Scan struk | GPT-4o Vision | - | - |

---

## STREAK

- Senin–Minggu 7 hari
- Semua task + tugas harus di-approve setiap hari
- 7/7 → bonus Rp 15.000 + 15 point (diklaim Minggu)
- Reset Senin 00:01

---

## XP & LEVEL

Formula: `round(20 * 1.4^(level-1))`

| Level | XP Needed | ~Hari |
|---|---|---|
| 1→2 | 20 | 4 |
| 2→3 | 28 | 6 |
| 3→4 | 39 | 8 |
| 5→6 | 77 | 15 |
| 10→11 | 404 | 81 |

---

## SOUND & ANIMASI

### Sound (Howler.js, <50KB, toggle on/off)
tap, task_done, approved, level_up, unlock, claim, streak, invest_done, switch

### Animasi (Motion/Framer Motion, 60fps)
- Avatar: idle breathing + kedip
- Pet: bounce + goyang
- XP bar: fill smooth + glow
- Level up: full screen confetti + fanfare
- Klaim: coin rain + sound
- Streak kotak: bounce saat check
- Task card: slide in + bounce
- Page transition: slide 250ms

---

## EDGE CASES

| Kondisi | Solusi |
|---|---|
| Tarik dana bukan Minggu | Tombol disabled + info |
| Tarik > saldo tersedia | Validasi, tidak bisa submit |
| Investasi baru saat ada aktif | Blocked |
| Double approve | Status atomic |
| Point negatif | Validasi minimal 0 |
| Setup wizard terpotong | Ulang dari awal |
| Task reset 00:00 | Submitted tetap pending |
| Foto struk | TIDAK disimpan |
