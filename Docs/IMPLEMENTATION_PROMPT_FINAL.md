# IMPLEMENTATION PROMPT — Winur Family Hub V3 (FINAL)
# Paste ke Claude Code di VS Code (project sudah ada, REVISI UI saja)

---

## ⚠️ PENTING — JANGAN BUILD ULANG DARI AWAL

Project ini **sudah berjalan** (Sprint 1–7 selesai: backend, Supabase DB, auth/PIN, server actions, API routes, Zustand — semua WORKING). Ini fase **REVISI UI/FRONTEND saja** dengan arsitektur baru "Satu Rumah, Dua Dunia" + kamar berbasis gambar.

### JANGAN SENTUH:
- Database / Supabase schema (boleh ALTER tambah kolom kalau perlu, jangan drop)
- Auth / PIN system
- Server Actions (task generate, approve, klaim, investasi, dll)
- API routes
- Zustand stores (boleh tambah state baru)
- Business logic (reward calc, XP, streak)
- `.env.local` / credentials

### YANG DIUBAH: tampilan/komponen UI saja.

### LANGKAH AMAN:
```bash
cp -r src/components src/components_backup   # backup dulu
```

---

## BACA DULU SEBELUM CODING
1. `ROOM_DAFFA_FINAL.html` — ⭐ buka di browser. Ini target visual + sistem kamar anak FINAL (background image + hotspot + collision + semua interaksi). **IKUTI PERSIS.**
2. `DESIGN_REFERENCE_V3.html` — target visual admin (Nintendo OS) + HUD + overlay
3. `REDESIGN_BLUEPRINT.md` — arsitektur lengkap
4. `01_PRD.md`, `03_DATABASE_ERD.md`, `06_DECISION_LOG.md`

---

# BAGIAN 1 — KONSEP "SATU RUMAH, DUA DUNIA"

## Area Admin — "Family Command Center" (Nintendo OS)
- Home: hero strip (saldo keluarga + status anak + pending count) + channel cards horizontal: Keuangan, Belanja, Dunia Daffa, Dunia Dio, Persetujuan, Pengaturan
- TANPA sidebar / bottom nav — navigasi via channel cards + tombol back
- Warna netral (bg #F4F5F7, surface #FFF), angka finansial besar (JetBrains Mono)
- Persetujuan = list gabungan (tugas + tarik dana + tukar poin semua anak)
- Tablet-first → desktop → mobile adaptif

## Area Anak — "Living World" (kamar interaktif)
- Kamar full-screen berbasis GAMBAR (bukan halaman cards, bukan SVG furniture)
- Fitur diakses via klik objek/hotspot
- TANPA navbar bawah

---

# BAGIAN 2 — KAMAR ANAK: BACKGROUND IMAGE + HOTSPOT (ARSITEKTUR FINAL)

## 2.1 Background berbasis gambar
- Latar kamar = GAMBAR yang di-upload admin (BUKAN SVG/HTML furniture)
- Setiap tema punya **gambar siang** + **gambar malam**
- Gambar upload = seluruh tampilan ruangan
- Hapus semua aset ruangan lama. Objek di atas background HANYA: **Avatar, Pet, Celengan**
- Ganti siang/malam = crossfade halus antar 2 gambar

## 2.2 Theme config (data-driven, mudah tambah tema TANPA ubah kode)
Setiap tema disimpan sebagai objek konfigurasi (DB tabel `room_themes` + JSON):
```ts
type RoomTheme = {
  id: string;
  name: string;
  dayImage: string;      // URL Supabase Storage
  nightImage: string;    // URL Supabase Storage
  owner_profile_id: string;  // tema milik anak siapa
  hotspots: Hotspot[];   // koordinat % (lihat 2.3)
  walkableArea: { xMin:number; xMax:number; bMin:number; bMax:number }; // % (bottom-based)
  blockedArea?: Rect[];  // area objek tak boleh masuk
  safeArea?: Rect[];     // area aman objek
  defaultPosition: { avatar:{x,b}; pet:{x,b}; piggy:{x,b} }; // % posisi awal
};
type Hotspot = { id:string; action:HotspotAction; left:number; top:number; w:number; h:number; label:string; icon:string };
type HotspotAction = 'avatar'|'task'|'history'|'daynight'|'theme';
```
- Koordinat dalam **persen** (responsif di semua ukuran layar)
- Admin saat upload tema → set koordinat hotspot (editor sederhana: drag kotak di atas gambar)
- Tambah tema baru = tambah row config, TIDAK perlu ubah kode kamar

## 2.3 Hotspot (zona klik transparan, koordinat x/y/w/h %)
| Hotspot | Aksi | Buka |
|---|---|---|
| Lemari | `avatar` | Sheet Ganti Avatar/Kostum |
| Meja belajar | `task` | Sheet Tugas |
| Rak samping kasur | `history` | Sheet Riwayat |
| Jendela | `daynight` | Toggle siang/malam (crossfade) |
| Kasur | `theme` | Sheet Pilih Tema Kamar |

- Hotspot transparan, hover = highlight tipis
- Dev mode: tombol "Lihat Hotspot" untuk debug posisi (opsional)

## 2.4 Interaksi kamar (ikuti ROOM_DAFFA_FINAL.html PERSIS)
| Aksi | Trigger | Hasil |
|---|---|---|
| Jalan | Klik lantai (walkableArea) | Avatar pindah ke titik (transisi) |
| Bicara | Klik avatar | Sapaan berurutan + wave + mulut gerak |
| Tugas | Klik hotspot meja | Sheet tugas slide-up |
| Kostum | Klik hotspot lemari | Sheet kostum slide-up |
| Riwayat | Klik hotspot rak | Sheet riwayat slide-up |
| Siang/Malam | Klik hotspot jendela | Crossfade gambar day↔night |
| Tema | Klik hotspot kasur | Sheet pilih tema |
| **Point Shop** | **Klik pill Poin 🪙 di HUD** | **Sheet Toko Poin slide-up** |
| Pet | Klik pet | Popup [Ambil / Aksi] |
| Pet Ambil | Pilih Ambil | Pet terangkat di atas avatar, ikut jalan; klik lagi = taruh |
| Pet Aksi | Pilih Aksi | Bunyi "Guk guk!" + animasi |
| Celengan | Klik celengan | Popup [Pindahkan / Saldo / Investasi] |

## 2.5 Celengan = PUSAT KEUANGAN
Klik celengan → 3 aksi:
1. **Pindahkan** — drag + simpan posisi (snap, collision-aware)
2. **Saldo** — buka sheet saldo (siap diklaim, tabungan, menunggu, klaim, tarik dana)
3. **Investasi** — buka sheet investasi

### Visual Investasi (TANPA objek pot/tanaman — HAPUS investasi dari pot)
- Progress investasi divisualkan lewat **UKURAN CELENGAN**
- Makin besar progress → celengan makin besar (lerp width min→max)
- Target tercapai → ukuran maksimum + glow + animasi perayaan + sound

## 2.6 Notifikasi tugas
- Jika ada tugas pending → ikon kecil bercahaya (glow) muncul di atas hotspot meja (koordinat dari config)

## 2.7 Karakter (Avatar SVG full body + sistem kostum)
- Avatar = SVG full body konsisten (BUKAN emoji, BUKAN PNG). JANGAN ubah base avatar.
- **Daffa**: bowl-cut hitam, kaos krem henley + saku, cargo olive, sepatu hijau-putih. Suara anak ±5th (pitch 1.8).
- **Dio**: rambut pendek hitam, kaos biru muda, celana pendek navy, sepatu biru-putih. Suara anak ±2th (pitch 2.2).
- **Kostum** = swap SVG layer (kit badan + hat + warna baju/celana/sepatu), bentuk BEDA bukan cuma warna:
  - Daffa: Biasa, Polisi (Lv10), Tentara (Lv12), BoboiBoy (Lv12), Minecraft/Steve (Lv3), Robot (Lv20), Astronot (Lv30), Bajak Laut (Lv40)
  - Dio: + Pemadam
- Kostum unlock by level. Locked = greyed + 🔒 + "Lv.X". Klik locked → "Naik level dulu!"
- Foto profil bulat di HUD boleh foto (admin upload); karakter DI KAMAR tetap render SVG full body.

### Aturan karakter (WAJIB)
- TIDAK melayang — berdiri di lantai + bayangan
- Idle = HANYA kedip (bukan bounce/napas)
- Mulut gerak saat bicara (class `.talking`)
- Mata tutup + bayangan hilang saat tidur

## 2.8 COLLISION DETECTION & SAFE AREA (WAJIB)
- Avatar, Pet, Celengan TIDAK BOLEH menimpa area hotspot
- Setiap hotspot punya safe area
- Objek dipindah ke area hotspot → otomatis geser ke posisi kosong terdekat (`clearHotspots()` / `placeSafe()`)
- Prioritas klik tetap ke hotspot (objek tidak menutupi hotspot)
- Avatar hanya gerak di walkableArea
- Pet gerak di area aman
- Celengan bisa dipindah tapi tak boleh menutupi objek interaktif
- Ganti tema → posisi Avatar/Pet/Celengan otomatis relayout ke defaultPosition/safeArea tema baru

## 2.9 Layer order (z-index)
```
Background (0) → Floor-click (1) → Hotspot (2) → Avatar (5) → Pet (6) → Celengan (7) → Effect/Notif (10) → Sheets (40)
```

## 2.10 Tema awal
- **Daffa**: tema Roket/luar angkasa ATAU Minecraft (gambar upload) — referensi gambar siang+malam tersedia di `assets/themes/`
- **Dio**: tema mobil/bus Tayo (admin upload gambar siang+malam)

---

# BAGIAN 3 — OVERLAY / SHEETS (slide-up dari bawah, z-40)

Saat klik hotspot/objek → sheet naik dari bawah (kamar tetap terlihat di belakang). Hanya 1 sheet terbuka. Klik ✕ / klik luar / klik lantai = tutup.

- **Tugas**: list tugas hari ini + status (menunggu/disetujui/mulai)
- **Kostum**: grid avatar unlock/locked by level
- **Riwayat**: list aktivitas (klaim, naik level, buka kostum, dll)
- **Saldo**: 3 stat (siap diklaim/tabungan/menunggu) + list klaim + tombol Tarik Dana (Minggu)
- **Investasi**: progress bar + tombol nominal; progress → ukuran celengan
- **Tema**: grid tema + slot "＋ Admin upload"
- **Toko Poin** (dari klik pill Poin): grid hadiah unlock/locked by poin, admin yang siapkan & approve

---

# BAGIAN 4 — AUDIO (Howler.js) + VOICE + MIC

## 4.1 Install
```bash
npm install howler @types/howler
```

## 4.2 Struktur file
```
public/sounds/
├── bgm/   login.mp3, daffa_room.mp3, dio_room.mp3, admin_home.mp3
└── sfx/   pop.mp3, coin.mp3, bark.mp3, sleep.mp3, wake.mp3, click.mp3, level_up.mp3, unlock.mp3, task_done.mp3
```
- MP3 belum ada → fallback Web Audio API (jangan error). Sumber BGM: Pixabay Music / Suno.ai.

## 4.3 AudioManager singleton (`src/lib/audio.ts`) via Howler
- `playBGM(track)`, `stopBGM/pauseBGM/resumeBGM`, `crossfadeBGM(newTrack, 800ms)`
- `playSFX(name)`, `setVolumeBGM/SFX(0-1)`, `muteAll/unmuteAll`, `unlockAudio()` (first interaction)
- State di Zustand (isMuted, bgmVolume, sfxVolume), persist localStorage + simpan `profiles.sound_settings` JSONB
- Autoplay: BGM mulai hanya setelah interaksi pertama

## 4.4 Crossfade BGM per halaman
profile picker→login.mp3 · admin→admin_home.mp3 · kamar Daffa→daffa_room.mp3 · kamar Dio→dio_room.mp3 (fade 800ms)

## 4.5 SFX triggers
klik→click · tugas selesai→task_done · naik level→level_up · unlock→unlock · klaim/coin→coin · tidur→sleep · bangun→wake · pet→bark · popup→pop

## 4.6 Voice (karakter bicara)
- Chain fallback: ElevenLabs API → SpeechSynthesis id-ID → default
- `.env.local` (opsional): `ELEVENLABS_API_KEY`, `DAFFA_VOICE_ID`, `DIO_VOICE_ID`
- Config: Daffa pitch 1.8 / rate 0.95 / id-ID · Dio pitch 2.2 / rate 0.90 / id-ID
- Saat bicara: pauseBGM → animasi .talking (mulut) → bubble text → resumeBGM
- Sapaan berurutan klik avatar: "Halo!" → "Selamat [pagi/siang/sore/malam]!" → "Aku [nama]!" → "Ayo belajar!" → "Ayo bermain!" → "Ayo istirahat!" → loop

## 4.7 Mic Echo
- Tombol 🎙️ pojok bawah kiri kamar
- Tap-tahan → "Bicara sekarang..." → rekam (SpeechRecognition API) → lepas stop → karakter "mendengar" 500ms → karakter ULANG kata user dengan voice system + bubble text → idle
- Permission mic hanya saat pertama tap (bukan saat load); ditolak → "Izinkan mikrofon di pengaturan browser"
- Saat rekam: setVolumeBGM(0.1), restore setelah selesai

---

# BAGIAN 5 — PROFILE PICKER & LOGIN
- Background ilustrasi rumah keluarga
- 4 kartu: Ayah (biru/admin), Mamah (pink/admin), Daffa (hijau/anak), Dio (ungu/anak)
- Avatar profil = foto bulat (admin upload) / fallback circle+inisial
- Admin → PIN 6 digit · Anak → PIN 4 digit (admin set)
- APK: hanya tampil kartu anak

---

# BAGIAN 6 — DB TAMBAHAN (untuk theme system)
Tambah tabel (ALTER/CREATE, jangan drop existing):
```sql
create table room_themes (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references profiles(id),
  name text not null,
  day_image_url text not null,
  night_image_url text not null,
  config jsonb not null,   -- hotspots, walkableArea, safeArea, defaultPosition
  is_active boolean default false,
  created_at timestamptz default now()
);
-- point shop: pakai tabel point_rewards / point_requests yang SUDAH ADA
-- profiles: pastikan ada kolom active_theme_id, sound_settings (jsonb)
alter table profiles add column if not exists active_theme_id uuid;
alter table profiles add column if not exists sound_settings jsonb default '{"muted":false,"bgm":0.35,"sfx":0.7}';
```
Storage bucket `room-themes` untuk upload gambar tema (RLS: admin write, semua read).

---

# STACK
Next.js 14 App Router, TS strict, Tailwind + shadcn/ui, Motion (Framer Motion), Howler.js, Zustand, RHF + Zod, Supabase (PostgreSQL + Realtime + Storage), Vercel, Capacitor (APK).

## .env.local (sudah ada, jangan ubah credentials)
```
NEXT_PUBLIC_SUPABASE_URL=https://rbcognkvhrkemlsbkmqa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiY29nbmt2aHJrZW1sc2JrbXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTY2MDUsImV4cCI6MjA5NjA5MjYwNX0.jDfYzmrpPlBJWDphJkr1EFVog1WVCTHzoz9m6W_c8_c
OPENAI_API_KEY=(isi sendiri)
# opsional voice premium:
ELEVENLABS_API_KEY=
DAFFA_VOICE_ID=
DIO_VOICE_ID=
```

---

# URUTAN KERJA (UI revision)
1. Backup: `cp -r src/components src/components_backup`
2. Install: `npm install howler @types/howler`
3. DB: tambah `room_themes`, kolom `active_theme_id`/`sound_settings`, bucket storage (migration)
4. `src/lib/audio.ts` — AudioManager (Howler) + Zustand audio store
5. Redesign **Profile Picker**
6. Redesign **Admin** layout (channel cards Nintendo OS) + semua halaman admin
7. Redesign **Kamar Anak** dari `ROOM_DAFFA_FINAL.html`:
   - Background image + crossfade day/night
   - Hotspot system (data-driven dari theme config)
   - Collision detection + safe area + walkable
   - Avatar SVG + kostum layer
   - Celengan finance hub (pindah/saldo/investasi → ukuran celengan)
   - Sheets: tugas, kostum, riwayat, saldo, investasi, tema, **toko poin (klik pill poin)**
   - Notif tugas glow di atas meja
   - Voice + Mic echo
8. Kamar **Dio** (tema Tayo, sistem SAMA, suara pitch 2.2, kostum Pemadam)
9. **Admin theme uploader** (upload gambar siang+malam + set koordinat hotspot)
10. Wire semua sheet ke server actions yang SUDAH ADA (klaim, approve, investasi, tukar poin)
11. Polish: animasi, sound, PWA, Capacitor APK
12. Test: semua flow lama masih berfungsi (jangan ada regresi)

## AUTO-APPROVAL
Langsung jalan: npm install, file create/edit, migration (CREATE/ALTER), build.
Tanya dulu: delete file existing, DROP table/column, deploy, ubah credentials.

## PRINSIP
- Jangan rusak backend/logic yang sudah jalan
- Kamar = data-driven (tambah tema tanpa ubah kode)
- Semua objek interaktif selalu terlihat & mudah diklik (collision + safe area)
- Konsisten dengan ROOM_DAFFA_FINAL.html & DESIGN_REFERENCE_V3.html
