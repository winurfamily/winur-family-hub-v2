# REDESIGN_BLUEPRINT.md — Winur Family Hub
Role: Product Designer & UX Architect
Status: PROPOSAL (belum implementasi)
Device Priority: TABLET-FIRST → Desktop adaptive → Mobile adaptive

---

# 1. EVALUASI UI SAAT INI

## Masalah Struktural
| Area | Masalah | Dampak |
|---|---|---|
| Layout anak | Sidebar kiri ala admin dashboard | Terasa seperti aplikasi kantor, bukan dunia anak |
| Ruang layar | Konten hanya pakai ±60% lebar tablet, banyak whitespace kanan | Tablet terasa seperti mobile yang diperbesar |
| Hierarki | Semua elemen sama besar, tidak ada focal point | Mata tidak tahu harus lihat ke mana |
| Card | Putih flat, border tipis, shadow minim | Tidak ada depth, terasa murah |
| Stat cards | 3 kotak kecil sejajar dengan ikon kecil | Informasi penting (saldo) tidak terasa penting |
| Empty state | Hanya emoji + teks | Membuang momen engagement |
| Streak | Kotak kecil polos di pojok | Fitur motivasi utama tapi tidak terlihat menarik |
| Admin | Tab pill horizontal + list vertikal panjang | Fungsional tapi datar, tidak premium |

## Masalah Emosional
- Area anak tidak memicu rasa "ini duniaku" — tidak ada karakter besar, tidak ada lingkungan
- Area admin tidak memicu rasa "ini pusat kendali keluarga" — terasa seperti form
- Tidak ada perbedaan atmosfer antara profil — semua orang dapat UI yang sama

## Yang Sudah Baik (dipertahankan)
- Struktur data & fungsi sudah benar (saldo, tabungan, investasi, streak, task)
- Informasi yang ditampilkan sudah tepat
- Flow klaim/tarik dana sudah jelas

---

# 2. VISI DESAIN BARU

## Konsep Payung: "Satu Rumah, Dua Dunia"

Satu ekosistem visual (logo, font, ikon keluarga yang sama) dengan dua atmosfer:

### Area Admin — "Family Command Center" (Nintendo OS style)
- Bersih, lapang, card besar dengan rounded corner besar
- Grid horizontal yang bisa di-scroll seperti home Nintendo Switch
- Warna netral terang + 1 aksen kuat per konteks
- Informasi finansial tampil besar dan percaya diri
- Tidak ada elemen kekanak-kanakan, tapi tetap hangat
- Mood: tenang, terkontrol, premium

### Area Anak — "Living World" (My Talking Tom Friends style)
- Full screen dunia interaktif, BUKAN halaman dengan card
- Karakter avatar besar hidup di tengah "kamar/halaman virtual"
- Objek di dunia = pintu masuk fitur (papan task, celengan, toko, rak koleksi)
- Minim teks, maksimal visual & ikon
- HUD ringan di tepi layar (saldo, point, level) seperti game
- Mood: ceria, eksploratif, "ini duniaku"

## Prinsip Desain
1. **Tablet adalah panggung** — setiap halaman didesain untuk landscape 10–13", baru diturunkan
2. **Satu focal point per layar** — selalu jelas apa yang paling penting
3. **Depth, bukan flat** — layering, shadow lembut, parallax ringan
4. **Hidup tanpa berisik** — idle animation halus, bukan animasi terus-menerus
5. **Fungsi tidak berubah** — redesign kulit & tata ruang, bukan logika

---

# 3. STRUKTUR NAVIGASI

## Profile Picker (Gerbang Rumah)
- Full screen, ilustrasi rumah keluarga sebagai background
- 4 kartu profil besar sejajar (landscape) — foto/avatar besar, nama, role
- Kartu admin: gaya clean (sudut presisi, warna solid)
- Kartu anak: gaya playful (glow warna personal, avatar karakter)
- Tap kartu → zoom-in transisi ke PIN → masuk dunia masing-masing

## Navigasi Admin (Nintendo OS pattern)
```
HOME ADMIN (landscape)
├── Row 1: Hero strip — ringkasan keluarga (saldo utama, 2 anak, notif pending)
├── Row 2: "Channel" cards besar horizontal-scroll:
│   [Keuangan] [Belanja] [Dunia Daffa] [Dunia Dio] [Persetujuan] [Pengaturan]
└── Row 3: Aktivitas terbaru (ticker ringkas)

Masuk channel → halaman penuh dengan:
- Header tetap (back + judul + konteks)
- Sub-nav tab horizontal DI DALAM halaman (bukan sidebar)
```
- TIDAK ada bottom nav di admin tablet — navigasi berbasis "channel card" + back
- Mobile admin: channel cards jadi grid 2 kolom; menu Belanja dapat shortcut permanen

## Navigasi Anak (World pattern)
```
DUNIA ANAK (full screen landscape)
├── Dunia tengah: kamar/halaman dengan avatar besar + pet
├── Objek interaktif di dunia:
│   📋 Papan Misi (dinding)      → Task & Tugas
│   🐷 Celengan (meja)           → Klaim Saldo & Tarik Dana
│   🌱 Pot Tanaman Ajaib (jendela) → Investasi
│   🎁 Toko/Etalase (pintu kanan)  → Point Shop
│   👕 Lemari (pintu kiri)         → Avatar & Koleksi
│   📖 Buku di rak                → Riwayat
├── HUD atas: saldo + point + level + notif (pill kecil semi-transparan)
└── HUD bawah-kanan: tombol kembali ke dunia (saat di dalam fitur)
```
- Fitur terbuka sebagai **overlay panel besar** di atas dunia (dunia tetap terlihat blur di belakang) — bukan pindah halaman
- Anak selalu merasa "tidak pernah meninggalkan kamarnya"
- Fallback: tetap sediakan mini-dock ikon (6 fitur) di tepi bawah untuk akses cepat & accessibility

---

# 4. RESPONSIVE STRATEGY

| Mode | Admin | Anak |
|---|---|---|
| **Tablet landscape (UTAMA)** | Channel cards 1 row scroll, konten 2–3 kolom, panel detail kanan permanen | Dunia full screen, objek tersebar horizontal, overlay panel 70% lebar |
| **Tablet portrait** | Channel cards grid 2×3, konten 2 kolom, panel detail jadi sheet | Dunia di-crop tengah (objek menyusun ulang), overlay panel 90% |
| **Desktop** | Sama dengan tablet landscape + max-width 1400px center, hover state aktif | Sama tablet landscape, dunia dibatasi 16:10 center, sisanya ambient gradient |
| **Mobile** | Grid 1 kolom; HANYA menu Belanja dioptimalkan penuh (quick scan 1 tangan, tombol besar bawah) | Dunia versi sederhana: avatar + dock ikon (objek dunia disembunyikan), overlay full screen |

Aturan teknis:
- Breakpoint dasar: <768 mobile, 768–1279 tablet, ≥1280 desktop
- Orientasi dideteksi terpisah dari lebar (landscape ≠ desktop)
- Semua touch target ≥48px, jarak antar target ≥8px
- Belanja mobile: input nominal numpad besar, scan struk 1 tap dari home

---

# 5. DESIGN SYSTEM

## 5.1 Foundation Bersama (satu ekosistem)
- Font: Nunito (display/angka) + Plus Jakarta Sans (body)
- Radius scale: 12 / 16 / 20 / 28
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48
- Ikon: satu set rounded konsisten (Lucide rounded / custom)
- Logo & identitas keluarga muncul di kedua dunia

## 5.2 Tema Admin — "Slate & Warm"
```
Background:   #F4F5F7 (abu hangat terang)
Surface:      #FFFFFF
Surface-alt:  #ECEEF2
Text:         #1C1E26 / #5A5F6E / #9AA0AE
Aksen utama:  #E60012 dipakai HEMAT (gaya Nintendo) → ganti: #FF6B35
Aksen sekunder per channel:
  Keuangan #2E7D32 · Belanja #F57C00 · Dunia Anak #7C3AED · Persetujuan #1976D2
Card: putih, radius 20, shadow 0 8px 24px rgba(28,30,38,0.08)
Angka finansial: JetBrains Mono / tabular, ukuran besar (32–48px)
```

## 5.3 Tema Anak — "Daylight World"
```
Langit:    gradient #87CEEB → #E8F4FD (siang, default)
           opsi sore #FFD3A5 → #FD9853 (berubah sesuai jam nyata!)
Tanah/lantai kamar: warm wood / hijau rumput
Panel overlay: putih 92% + radius 28 + shadow dalam
HUD pill:  rgba(255,255,255,0.85) + blur, border 2px warna personal anak
Warna personal: Daffa = #4CAF50, Dio = #7C3AED
Aksen aksi:  oranye #FF6B35 (tombol utama), kuning #FFD93D (reward)
```

## 5.4 Komponen Kunci
| Komponen | Admin | Anak |
|---|---|---|
| Tombol utama | Solid, radius 14, tanpa shadow tebal | Bulat/capsule, bottom-shadow 4px, bounce saat tap |
| Card | Flat elevated, hover lift | Panel kayu/awan dengan border tebal lembut |
| Angka uang | Besar, mono, hitam | Besar, putih outline, dengan ikon koin |
| Progress | Bar tipis presisi | Bar gemuk dengan glow & karakter kecil |
| Tab | Underline minimal | Pill besar berwarna |
| Modal | Sheet dari kanan (tablet) | Overlay panel dengan dunia blur di belakang |

---

# 6. USER FLOW

## Flow Anak: Selesaikan Task → Klaim
```
Dunia → tap Papan Misi → overlay Task terbuka (dunia blur)
→ pilih task → kerjakan → "Selesai" → kartu task berubah "Menunggu Ayah/Ibu"
→ [admin approve] → notif muncul di dunia: celengan bergetar + badge
→ tap Celengan → daftar "Siap Diklaim" → tap Klaim → koin terbang ke HUD saldo
→ saldo HUD bertambah dengan counter naik
```

## Flow Anak: Tarik Dana (Minggu)
```
Celengan → tab "Tarik Dana" (hanya aktif Minggu, hari lain terlihat terkunci dengan countdown)
→ input nominal (numpad besar) → kirim → status "Menunggu Ayah/Ibu"
→ approve → animasi amplop uang → riwayat
```

## Flow Admin: Pagi Hari (use case utama)
```
Buka app → Profile Ayah → PIN
→ HOME: hero strip sudah menunjukkan "3 menunggu persetujuan"
→ tap channel Persetujuan → list gabungan (task selesai, tarik dana, point shop)
→ approve beruntun (swipe/tap) → selesai <1 menit
```

## Flow Admin: Belanja (mobile, di luar rumah)
```
Buka app di HP → Ayah → PIN → home grid → Belanja (posisi pertama di mobile)
→ tombol besar "Scan Struk" → kamera → AI ekstrak → konfirmasi → simpan
```

---

# 7. LAYOUT PER HALAMAN

## ADMIN

### A1. Home Admin (tablet landscape)
```
┌──────────────────────────────────────────────────────────┐
│ Selamat pagi, Ayah 👋          [foto Ayah] [🔔3] [⚙]    │
│ ┌────────────────────────────────────────────────────┐  │
│ │ HERO STRIP: Saldo Keluarga Rp 3.000.000            │  │
│ │ Daffa Lv12 ●●●○ hari ini | Dio Lv1 ○○○○ | 3 pending│  │
│ └────────────────────────────────────────────────────┘  │
│  CHANNEL (scroll horizontal, card 280×180)               │
│  [💰 Keuangan] [🛒 Belanja] [🧒 Daffa] [👦 Dio]          │
│  [✅ Persetujuan •3] [⚙ Pengaturan]                      │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Aktivitas terbaru (3 baris ringkas)                │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### A2. Keuangan
- Kolom kiri (60%): saldo utama besar + grafik pengeluaran bulan + pendapatan terbaru
- Kolom kanan (40%): pocket cards stack + tombol transfer
- Sub-tab atas: Dashboard | Pocket | Transfer | Riwayat

### A3. Belanja (tablet)
- Kiri: rencana belanja aktif (checklist besar)
- Kanan: quick actions (Scan Struk, Input Manual) + riwayat bulan
- Mobile: urutan dibalik, Scan Struk jadi tombol sticky bawah

### A4. Dunia Anak (per anak)
- Header: avatar anak besar + level + streak minggu ini
- Grid 2×2 panel: Task Hari Ini (kelola) | Saldo & Tarik Dana | Investasi | Avatar & Shop
- Panel Persetujuan mengambang kanan jika ada pending

### A5. Persetujuan (gabungan)
- List kartu besar per request: jenis + anak + detail + 2 tombol (Tolak/Setujui)
- Approve = kartu terbang keluar (swipe animation)

## ANAK

### C1. Dunia Utama (landscape)
```
┌──────────────────────────────────────────────────────────┐
│ [🪙 Rp 125.000] [⭐250]              [Lv.12 ▓▓▓░] [🔔]   │  ← HUD
│                                                          │
│   📋Papan        🪟(Pot🌱)                  🎁Etalase     │
│   Misi                                                   │
│            ┌────────────┐                                │
│            │  AVATAR    │      🐕 pet                    │
│            │  BESAR     │                                │
│            └────────────┘                                │
│   👕Lemari          📖Rak buku          🐷Celengan        │
│ ──────────────── lantai kamar ───────────────────────── │
│        [dock mini: 📋 🌱 👕 🐷 🎁 📖]                     │  ← fallback dock
└──────────────────────────────────────────────────────────┘
```
- Objek punya badge merah jika ada hal baru (task baru, klaim siap)
- Papan misi menampilkan progress 3/4 langsung di dunia

### C2. Overlay Task
- Panel 70% tengah, dunia blur
- 4 kartu task besar bergambar (AI image), status jelas per kartu
- Tugas (5 soal): mode fokus full screen, 1 soal per layar, progress dots

### C3. Overlay Celengan (Klaim & Tarik)
- Atas: 3 angka besar (Tersedia / Total diklaim / Menunggu)
- Tab: Siap Diklaim | Tarik Dana | Riwayat
- Klaim = tap → koin loncat ke HUD

### C4. Overlay Pot Investasi
- Kiri: tanaman tumbuh sesuai progress hari (visual metafora!)
  hari 1 = tunas → hari 30 = pohon berbuah koin
- Kanan: form nominal + quick chips + estimasi besar

### C5. Overlay Lemari (Avatar)
- Karakter besar kiri (preview live saat pilih)
- Grid kostum kanan: unlock berwarna, locked siluet gelap + "Lv.X"
- Tap kostum → karakter langsung ganti baju dengan animasi

### C6. Overlay Etalase (Point Shop)
- Rak toko visual, item dipajang di rak
- Item locked di rak atas dengan gembok
- Tukar = item turun dari rak ke "keranjang" → menunggu approve

### C7. Overlay Buku (Riwayat)
- Buku terbuka 2 halaman: kiri filter ikon besar, kanan daftar
- Entri pakai ikon + warna, minim teks

---

# 8. WIREFRAME / MOCKUP KONSEP

Deliverable berikutnya (setelah blueprint disetujui):
1. Mockup statis 6 layar kunci: Profile Picker, Home Admin, Keuangan, Dunia Anak, Overlay Task, Overlay Celengan
2. Format: HTML interaktif (DESIGN_REFERENCE_V3.html) — bisa dibuka di tablet langsung untuk merasakan proporsi nyata
3. Mockup menyertakan state: default, empty, pending, success

(Wireframe ASCII di bagian 7 menjadi acuan komposisi.)

---

# 9. ANIMASI & TRANSISI

## Prinsip
- 200–300ms untuk UI, 400–800ms untuk reward
- Spring easing (bukan linear) untuk semua elemen anak
- Admin: fade+slide halus saja, tanpa bounce

## Katalog
| Momen | Animasi |
|---|---|
| Buka profil | Kartu zoom-in jadi layar penuh (shared element) |
| Masuk dunia anak | Pintu kamar terbuka / iris wipe |
| Idle avatar | Napas + kedip tiap 4–6s + gestur random tiap 20s |
| Idle dunia | Awan bergerak, daun bergoyang, pet jalan-jalan kecil |
| Tap objek dunia | Objek squash & stretch + overlay slide-up |
| Task selesai | Stempel "Menunggu" jatuh ke kartu |
| Approve masuk (anak) | Celengan bergetar + badge pop |
| Klaim | Koin parabola ke HUD + counter naik + ding |
| Naik level | Layar flash lembut + confetti + badge baru pop |
| Streak harian | Kotak hari menyala berurutan |
| Streak 7/7 | Rainbow sweep di papan streak |
| Investasi progress | Tanaman tumbuh dengan stage transition |
| Admin approve | Kartu request terbang keluar kanan |
| Waktu nyata | Langit dunia berubah pagi/sore/malam mengikuti jam |

---

# 10. KOMPONEN YANG PERLU DIUBAH

| Prioritas | Komponen | Perubahan |
|---|---|---|
| P0 | Layout shell anak | Sidebar → dunia full screen + overlay system |
| P0 | Layout shell admin | Tab pills → home channel cards + halaman channel |
| P0 | HUD anak | Top bar baru: pill saldo/point/level semi-transparan |
| P0 | Bottom dock anak | Dock ikon mini (pengganti & fallback objek dunia) |
| P1 | Card system | 2 varian tema (admin elevated / anak playful panel) |
| P1 | Tombol | 2 varian (admin solid / anak capsule bounce) |
| P1 | Overlay/Modal | Panel besar dengan world-blur backdrop |
| P1 | Profile picker | Redesign rumah keluarga + zoom transition |
| P1 | Stat angka uang | Komponen MoneyDisplay besar (admin & anak beda gaya) |
| P2 | Streak board | Visual papan dengan glow per hari |
| P2 | Investasi | Komponen tanaman tumbuh (visual stage 1–5) |
| P2 | Point shop | Layout rak etalase |
| P2 | Lemari avatar | Preview live karakter |
| P2 | Empty states | Ilustrasi + CTA per konteks |
| P3 | Ambient dunia | Parallax + day/night cycle |
| P3 | Sound pass | Re-mapping sound ke momen baru |

---

# 11. PRIORITAS IMPLEMENTASI

## Fase 1 — Struktur (dampak terbesar)
1. Shell anak baru: dunia full screen + HUD + dock + overlay system
2. Shell admin baru: home channels + halaman channel
3. Profile picker baru
→ Setelah fase ini app sudah "terasa berbeda total" walau konten dalam overlay masih UI lama

## Fase 2 — Konten Anak
4. Overlay Task + mode fokus tugas
5. Overlay Celengan (klaim/tarik)
6. Overlay Lemari + Etalase + Buku
7. Komponen tanaman investasi

## Fase 3 — Konten Admin
8. Keuangan 2 kolom + Belanja (incl. mobile mode)
9. Halaman per-anak + Persetujuan gabungan

## Fase 4 — Jiwa
10. Animasi reward & idle penuh
11. Day/night + ambient
12. Sound re-mapping + polish + QA tablet portrait/mobile

Estimasi bobot: Fase 1 = 35%, Fase 2 = 30%, Fase 3 = 20%, Fase 4 = 15%

---

# 12. RISIKO & REKOMENDASI

| Risiko | Level | Mitigasi |
|---|---|---|
| Scope membengkak (dunia interaktif = banyak asset) | TINGGI | Objek dunia v1 pakai ilustrasi statis + badge; interaktivitas penuh menyusul |
| Performa animasi di tablet Android low-end | SEDANG | Batasi particle, gunakan transform/opacity saja, sediakan toggle "Mode Hemat" |
| Anak bingung navigasi objek (discoverability) | SEDANG | Dock mini selalu ada + onboarding 1x (tangan menunjuk objek) |
| Overlay system menabrak routing existing | SEDANG | Overlay = route paralel (intercepting routes Next.js), URL tetap valid |
| Asset dunia (kamar, objek) butuh ilustrasi konsisten | TINGGI | Generate 1x via AI dengan style lock, simpan sebagai asset statis (bukan generate berulang) |
| Admin terasa terlalu berbeda dari anak | RENDAH | Foundation bersama (font, ikon, radius) menjaga benang merah |
| Regresi fungsi saat ganti shell | SEDANG | Redesign HANYA layer presentasi; semua server action & query tidak disentuh; QA checklist per fitur |
| Mobile anak jadi aneh (dunia sempit) | RENDAH | Mode mobile anak = avatar + dock (dunia disembunyikan), fungsional penuh |

## Rekomendasi Keputusan
1. **Setujui konsep "Satu Rumah, Dua Dunia"** sebelum mockup dibuat
2. Konfirmasi: objek dunia interaktif (C1) vs dock-only — saya rekomendasikan **dunia + dock** (dock menjamin usability, dunia memberi jiwa)
3. Konfirmasi: day/night cycle ikut jam nyata — rekomendasi **ya** (efek "hidup" terbesar dengan effort kecil)
4. Setelah blueprint disetujui → saya buatkan DESIGN_REFERENCE_V3.html (mockup interaktif) → baru prompt implementasi per fase

---

*Blueprint ini adalah acuan desain. Tidak ada kode yang diubah sampai blueprint & mockup disetujui.*
